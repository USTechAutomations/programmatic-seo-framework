#!/usr/bin/env tsx
// =============================================================================
// validate-content.ts - Content Quality and Uniqueness Validator
// =============================================================================
// Runs comprehensive checks on content before publishing to ensure:
// 1. Genuine uniqueness (not just word shuffling)
// 2. Quality standards are met
// 3. SEO requirements are satisfied
// 4. No duplicate or near-duplicate content exists
// =============================================================================

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const BLOG_DIR = path.join(process.cwd(), 'content/blog');
const VALIDATION_LOG = path.join(process.cwd(), 'knowledge-base/metrics/validation-log.json');

interface ValidationResult {
  file: string;
  passed: boolean;
  score: number;
  checks: CheckResult[];
  timestamp: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  score: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ContentFingerprint {
  slug: string;
  titleHash: string;
  contentHash: string;
  keyPhrases: string[];
  wordCount: number;
  datapointSignatures: string[];
}

// -----------------------------------------------------------------------------
// VALIDATION CHECKS
// -----------------------------------------------------------------------------

class ContentValidator {
  private fingerprints: Map<string, ContentFingerprint> = new Map();

  async loadExistingFingerprints(): Promise<void> {
    if (!fs.existsSync(BLOG_DIR)) return;

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(BLOG_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data, content: body } = matter(content);

      const fingerprint = this.createFingerprint(file, data, body);
      this.fingerprints.set(fingerprint.slug, fingerprint);
    }
  }

  private createFingerprint(file: string, data: any, content: string): ContentFingerprint {
    const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

    // Extract key phrases (5-7 word meaningful sequences)
    const keyPhrases = this.extractKeyPhrases(content);

    // Extract datapoint signatures (numbers + context)
    const datapointSignatures = this.extractDatapointSignatures(content);

    return {
      slug,
      titleHash: crypto.createHash('md5').update(data.title || '').digest('hex'),
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      keyPhrases,
      wordCount: content.split(/\s+/).length,
      datapointSignatures,
    };
  }

  private extractKeyPhrases(content: string): string[] {
    const text = content
      .replace(/^---[\s\S]*?---/, '')
      .replace(/[#*_`\[\](){}]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ');

    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 30);
    const phrases: string[] = [];

    for (const sentence of sentences.slice(0, 20)) {
      const words = sentence.trim().split(' ').filter(w => w.length > 3);
      if (words.length >= 5) {
        phrases.push(words.slice(0, 6).join(' '));
      }
    }

    return phrases;
  }

  private extractDatapointSignatures(content: string): string[] {
    // Find sentences with numbers/percentages
    const numberPattern = /[^.!?]*\d+[%]?[^.!?]*/g;
    const matches = content.match(numberPattern) || [];

    return matches
      .map(m => m.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter(m => m.length > 20)
      .slice(0, 10);
  }

  async validateFile(filePath: string): Promise<ValidationResult> {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data, content: body } = matter(content);
    const checks: CheckResult[] = [];

    // Run all validation checks
    checks.push(this.checkMinWordCount(body));
    checks.push(this.checkTitle(data.title));
    checks.push(this.checkDescription(data.description));
    checks.push(this.checkTags(data.tags));
    checks.push(this.checkStructure(body));
    checks.push(this.checkUniqueness(filePath, data, body));
    checks.push(this.checkDataPoints(body));
    checks.push(this.checkFAQ(body, data));
    checks.push(this.checkActionability(body));
    checks.push(this.checkFirstParagraph(body));

    const passed = checks.every(c => c.severity !== 'error' || c.passed);
    const score = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;

    return {
      file: path.basename(filePath),
      passed,
      score,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private checkMinWordCount(content: string): CheckResult {
    const wordCount = content.split(/\s+/).length;
    const minWords = 1500;
    const passed = wordCount >= minWords;

    return {
      name: 'Minimum Word Count',
      passed,
      score: Math.min(wordCount / minWords, 1),
      message: passed
        ? `Word count: ${wordCount} (meets ${minWords} minimum)`
        : `Word count: ${wordCount} (below ${minWords} minimum)`,
      severity: passed ? 'info' : 'error',
    };
  }

  private checkTitle(title: string): CheckResult {
    if (!title) {
      return {
        name: 'Title Check',
        passed: false,
        score: 0,
        message: 'Title is missing',
        severity: 'error',
      };
    }

    const issues: string[] = [];
    if (title.length > 60) issues.push('Title exceeds 60 characters');
    if (title.length < 20) issues.push('Title is too short');
    if (!/[a-z]/i.test(title)) issues.push('Title has no letters');

    const passed = issues.length === 0;
    return {
      name: 'Title Check',
      passed,
      score: passed ? 1 : 0.5,
      message: passed ? `Title OK: "${title}"` : issues.join('; '),
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkDescription(description: string): CheckResult {
    if (!description) {
      return {
        name: 'Description Check',
        passed: false,
        score: 0,
        message: 'Meta description is missing',
        severity: 'error',
      };
    }

    const issues: string[] = [];
    if (description.length > 160) issues.push('Description exceeds 160 characters');
    if (description.length < 50) issues.push('Description is too short');

    const passed = issues.length === 0;
    return {
      name: 'Description Check',
      passed,
      score: passed ? 1 : 0.5,
      message: passed ? `Description OK (${description.length} chars)` : issues.join('; '),
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkTags(tags: string[]): CheckResult {
    if (!tags || tags.length === 0) {
      return {
        name: 'Tags Check',
        passed: false,
        score: 0,
        message: 'No tags specified',
        severity: 'warning',
      };
    }

    const passed = tags.length >= 2 && tags.length <= 8;
    return {
      name: 'Tags Check',
      passed,
      score: passed ? 1 : 0.5,
      message: `${tags.length} tags: ${tags.join(', ')}`,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkStructure(content: string): CheckResult {
    const h2Count = (content.match(/^## /gm) || []).length;
    const h3Count = (content.match(/^### /gm) || []).length;
    const listCount = (content.match(/^[*-] /gm) || []).length;

    const issues: string[] = [];
    if (h2Count < 3) issues.push('Less than 3 H2 headers');
    if (h3Count < 2) issues.push('Less than 2 H3 headers');
    if (listCount < 3) issues.push('Less than 3 bullet points');

    const passed = issues.length === 0;
    return {
      name: 'Content Structure',
      passed,
      score: passed ? 1 : 0.6,
      message: passed
        ? `Good structure: ${h2Count} H2s, ${h3Count} H3s, ${listCount} list items`
        : issues.join('; '),
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkUniqueness(filePath: string, data: any, content: string): CheckResult {
    const currentSlug = path.basename(filePath).replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const currentFingerprint = this.createFingerprint(path.basename(filePath), data, content);

    let maxSimilarity = 0;
    let mostSimilarSlug = '';

    for (const [slug, existing] of this.fingerprints) {
      if (slug === currentSlug) continue;

      // Check key phrase overlap
      const currentSet = new Set(currentFingerprint.keyPhrases);
      const existingSet = new Set(existing.keyPhrases);
      let overlap = 0;

      for (const phrase of currentSet) {
        if (existingSet.has(phrase)) overlap++;
      }

      const similarity = overlap / Math.max(currentSet.size, 1);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarSlug = slug;
      }

      // Check exact title match
      if (currentFingerprint.titleHash === existing.titleHash) {
        return {
          name: 'Uniqueness Check',
          passed: false,
          score: 0,
          message: `DUPLICATE TITLE found with: ${slug}`,
          severity: 'error',
        };
      }
    }

    const threshold = 0.4; // Max 40% phrase overlap allowed
    const passed = maxSimilarity < threshold;

    return {
      name: 'Uniqueness Check',
      passed,
      score: 1 - maxSimilarity,
      message: passed
        ? `Uniqueness: ${((1 - maxSimilarity) * 100).toFixed(1)}%`
        : `Too similar to "${mostSimilarSlug}" (${(maxSimilarity * 100).toFixed(1)}% overlap)`,
      severity: passed ? 'info' : 'error',
    };
  }

  private checkDataPoints(content: string): CheckResult {
    // Look for specific data: numbers, percentages, statistics
    const dataPattern = /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\$\d+(?:,\d{3})*(?:\.\d+)?[KMB]?)\b/g;
    const matches = content.match(dataPattern) || [];

    // Filter out trivial numbers (1-10, dates, etc.)
    const meaningfulData = matches.filter(m => {
      const num = parseFloat(m.replace(/[,$%KMB]/g, ''));
      return num > 10 || m.includes('%') || m.includes('$');
    });

    const minDataPoints = 5;
    const passed = meaningfulData.length >= minDataPoints;

    return {
      name: 'Data Points Check',
      passed,
      score: Math.min(meaningfulData.length / minDataPoints, 1),
      message: `Found ${meaningfulData.length} data points (minimum: ${minDataPoints})`,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkFAQ(content: string, data: any): CheckResult {
    // Check for FAQ section in content or frontmatter
    const hasFAQSection = /## FAQ|## Frequently Asked/i.test(content);
    const hasFAQFrontmatter = data.faqItems && data.faqItems.length > 0;

    if (!hasFAQSection && !hasFAQFrontmatter) {
      return {
        name: 'FAQ Section',
        passed: false,
        score: 0,
        message: 'No FAQ section found (important for AI Overviews)',
        severity: 'warning',
      };
    }

    // Count Q&A pairs
    const qaPattern = /\*\*Q:|### .+\?/g;
    const qaCount = (content.match(qaPattern) || []).length + (data.faqItems?.length || 0);

    const passed = qaCount >= 3;
    return {
      name: 'FAQ Section',
      passed,
      score: Math.min(qaCount / 5, 1),
      message: `${qaCount} FAQ items found`,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkActionability(content: string): CheckResult {
    // Look for actionable language patterns
    const actionPatterns = [
      /\bstep \d+\b/gi,
      /\bhow to\b/gi,
      /\byou can\b/gi,
      /\byou should\b/gi,
      /\bto do this\b/gi,
      /\bhere's how\b/gi,
      /\bfor example\b/gi,
      /\bspecifically\b/gi,
      /\bpractical\b/gi,
      /\bactionable\b/gi,
    ];

    let actionScore = 0;
    for (const pattern of actionPatterns) {
      const matches = content.match(pattern) || [];
      actionScore += matches.length;
    }

    const minActions = 10;
    const passed = actionScore >= minActions;

    return {
      name: 'Actionability Check',
      passed,
      score: Math.min(actionScore / minActions, 1),
      message: passed
        ? `Good actionability: ${actionScore} action indicators`
        : `Low actionability: ${actionScore} action indicators (aim for ${minActions}+)`,
      severity: passed ? 'info' : 'warning',
    };
  }

  private checkFirstParagraph(content: string): CheckResult {
    // Extract first paragraph (after frontmatter and headers)
    const cleanContent = content
      .replace(/^---[\s\S]*?---/, '')
      .replace(/^#+ .+$/gm, '')
      .trim();

    const firstParagraph = cleanContent.split('\n\n')[0] || '';

    if (firstParagraph.length < 50) {
      return {
        name: 'First Paragraph (Answer Intent)',
        passed: false,
        score: 0,
        message: 'First paragraph is too short to answer search intent',
        severity: 'error',
      };
    }

    // Check for direct answer patterns
    const directAnswerPatterns = [
      /\bis\b/i,
      /\bare\b/i,
      /\bmeans\b/i,
      /\brefers to\b/i,
      /\binvolves\b/i,
      /\bincludes\b/i,
    ];

    const hasDirectAnswer = directAnswerPatterns.some(p => p.test(firstParagraph));

    return {
      name: 'First Paragraph (Answer Intent)',
      passed: hasDirectAnswer,
      score: hasDirectAnswer ? 1 : 0.5,
      message: hasDirectAnswer
        ? 'First paragraph appears to answer the search intent'
        : 'First paragraph may not directly answer the search intent',
      severity: hasDirectAnswer ? 'info' : 'warning',
    };
  }
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0];

  const validator = new ContentValidator();
  await validator.loadExistingFingerprints();

  const results: ValidationResult[] = [];

  if (targetFile) {
    // Validate single file
    const filePath = path.isAbsolute(targetFile)
      ? targetFile
      : path.join(BLOG_DIR, targetFile);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const result = await validator.validateFile(filePath);
    results.push(result);
  } else {
    // Validate all files
    if (!fs.existsSync(BLOG_DIR)) {
      console.log('No blog directory found. Skipping validation.');
      process.exit(0);
    }

    const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const result = await validator.validateFile(path.join(BLOG_DIR, file));
      results.push(result);
    }
  }

  // Output results
  console.log('\n========================================');
  console.log('CONTENT VALIDATION RESULTS');
  console.log('========================================\n');

  let allPassed = true;

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const statusIcon = result.passed ? '[OK]' : '[X]';

    console.log(`${statusIcon} ${result.file}`);
    console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);

    for (const check of result.checks) {
      const checkIcon = check.passed ? ' ' : (check.severity === 'error' ? 'X' : '!');
      console.log(`   [${checkIcon}] ${check.name}: ${check.message}`);
    }

    console.log('');

    if (!result.passed) allPassed = false;
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  console.log('========================================');
  console.log(`SUMMARY: ${passedCount}/${results.length} files passed validation`);
  console.log('========================================\n');

  // Save validation log
  const logDir = path.dirname(VALIDATION_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  let existingLog: ValidationResult[] = [];
  if (fs.existsSync(VALIDATION_LOG)) {
    existingLog = JSON.parse(fs.readFileSync(VALIDATION_LOG, 'utf8'));
  }

  fs.writeFileSync(
    VALIDATION_LOG,
    JSON.stringify([...results, ...existingLog].slice(0, 1000), null, 2)
  );

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
