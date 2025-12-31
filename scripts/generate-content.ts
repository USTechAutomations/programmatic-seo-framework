#!/usr/bin/env tsx
// =============================================================================
// generate-content.ts - AI Content Generation Script
// =============================================================================
// Generates unique, high-quality blog content with built-in differentiation.
// Usage: tsx scripts/generate-content.ts --topic "AI Lead Nurturing" --keyword "ai lead nurturing"
// =============================================================================

import fs from 'fs';
import path from 'path';
import { ContentGenerator, ContentBrief, GeneratedContent } from '../src/lib/content-generator';
import dotenv from 'dotenv';

dotenv.config();

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const BLOG_DIR = path.join(process.cwd(), 'content/blog');
const DRAFTS_DIR = path.join(process.cwd(), 'content/drafts');
const LOG_DIR = path.join(process.cwd(), 'knowledge-base/experiments');

interface GenerationOptions {
  topic: string;
  keyword: string;
  intent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  audience: string;
  publishImmediately: boolean;
  skipReview: boolean;
}

// -----------------------------------------------------------------------------
// ARGUMENT PARSING
// -----------------------------------------------------------------------------

function parseArgs(): GenerationOptions {
  const args = process.argv.slice(2);
  const options: GenerationOptions = {
    topic: '',
    keyword: '',
    intent: 'informational',
    audience: 'real estate professionals',
    publishImmediately: false,
    skipReview: false,
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];

    switch (key) {
      case 'topic':
        options.topic = value;
        break;
      case 'keyword':
        options.keyword = value;
        break;
      case 'intent':
        options.intent = value as GenerationOptions['intent'];
        break;
      case 'audience':
        options.audience = value;
        break;
      case 'publish':
        options.publishImmediately = value === 'true';
        break;
      case 'skip-review':
        options.skipReview = value === 'true';
        break;
    }
  }

  return options;
}

// -----------------------------------------------------------------------------
// CONTENT GENERATION
// -----------------------------------------------------------------------------

async function generateContent(options: GenerationOptions): Promise<GeneratedContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  console.log('\n========================================');
  console.log('PROGRAMMATIC SEO CONTENT GENERATION');
  console.log('========================================\n');

  console.log(`Topic: ${options.topic}`);
  console.log(`Keyword: ${options.keyword}`);
  console.log(`Intent: ${options.intent}`);
  console.log(`Audience: ${options.audience}`);
  console.log('');

  // Initialize generator
  const generator = new ContentGenerator(apiKey, BLOG_DIR);
  await generator.initialize();

  console.log('[1/4] Generating content brief...');
  const brief = await generator.generateBrief(
    options.topic,
    options.keyword,
    options.intent,
    options.audience
  );

  console.log(`      Angle: ${brief.contentAngle}`);
  console.log(`      Differentiators: ${brief.differentiators.length}`);
  console.log(`      Data points: ${brief.dataPoints.length}`);
  console.log('');

  console.log('[2/4] Generating content...');
  let content = await generator.generateContent(brief);

  console.log(`      Initial score: ${(content.uniquenessScore * 100).toFixed(1)}%`);
  console.log('');

  // Check if regeneration needed
  if (!content.differentiationReport.passesThreshold) {
    console.log('[3/4] Content below threshold, regenerating...');
    content = await generator.regenerateIfNeeded(content, brief);
    console.log(`      Final score: ${(content.uniquenessScore * 100).toFixed(1)}%`);
  } else {
    console.log('[3/4] Content passes uniqueness threshold');
  }

  console.log('');
  console.log('[4/4] Preparing output...');

  return content;
}

// -----------------------------------------------------------------------------
// FILE OUTPUT
// -----------------------------------------------------------------------------

function saveContent(content: GeneratedContent, options: GenerationOptions): string {
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${content.slug}.md`;

  // Determine output directory
  const outputDir = options.publishImmediately ? BLOG_DIR : DRAFTS_DIR;

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create frontmatter
  const frontmatter = `---
title: "${content.title}"
description: "${content.metaDescription}"
date: ${date}
author: "US Tech Automations"
tags: ${JSON.stringify(options.topic.split(' ').slice(0, 4))}
slug: "${content.slug}"
category: "${options.topic.split(' ')[0]}"
draft: ${!options.publishImmediately}
autoGenerated: true
reviewedBy: ${options.skipReview ? '"auto-approved"' : 'null'}
reviewedAt: ${options.skipReview ? `"${new Date().toISOString()}"` : 'null'}
templateType: "programmatic-seo"
contentHash: "${content.contentHash}"
uniquenessScore: ${content.uniquenessScore.toFixed(2)}
qualityScore: ${content.qualityScore.toFixed(2)}
faqItems:
${content.faqItems.map(faq => `  - question: "${faq.question}"
    answer: "${faq.answer.replace(/"/g, '\\"')}"`).join('\n')}
---

`;

  const fullContent = frontmatter + content.content;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, fullContent);

  return outputPath;
}

// -----------------------------------------------------------------------------
// LOGGING
// -----------------------------------------------------------------------------

function logGeneration(
  content: GeneratedContent,
  options: GenerationOptions,
  outputPath: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    topic: options.topic,
    keyword: options.keyword,
    intent: options.intent,
    slug: content.slug,
    wordCount: content.wordCount,
    uniquenessScore: content.uniquenessScore,
    qualityScore: content.qualityScore,
    differentiationReport: content.differentiationReport,
    outputPath,
    status: options.publishImmediately ? 'published' : 'draft',
  };

  // Ensure log directory exists
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const logFile = path.join(LOG_DIR, 'generation-log.json');
  let existingLog: any[] = [];

  if (fs.existsSync(logFile)) {
    existingLog = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  }

  existingLog.unshift(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(existingLog.slice(0, 500), null, 2));
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

async function main() {
  try {
    const options = parseArgs();

    if (!options.topic || !options.keyword) {
      console.error('Usage: tsx scripts/generate-content.ts --topic "Topic" --keyword "keyword"');
      console.error('');
      console.error('Options:');
      console.error('  --topic      Main topic of the content');
      console.error('  --keyword    Target SEO keyword');
      console.error('  --intent     Search intent (informational|transactional|commercial|navigational)');
      console.error('  --audience   Target audience description');
      console.error('  --publish    Whether to publish immediately (true|false)');
      console.error('  --skip-review  Skip human review (true|false)');
      process.exit(1);
    }

    const content = await generateContent(options);
    const outputPath = saveContent(content, options);

    logGeneration(content, options, outputPath);

    console.log('');
    console.log('========================================');
    console.log('GENERATION COMPLETE');
    console.log('========================================');
    console.log('');
    console.log(`Title: ${content.title}`);
    console.log(`Slug: ${content.slug}`);
    console.log(`Words: ${content.wordCount}`);
    console.log(`Uniqueness: ${(content.uniquenessScore * 100).toFixed(1)}%`);
    console.log(`Quality: ${(content.qualityScore * 100).toFixed(1)}%`);
    console.log(`Output: ${outputPath}`);
    console.log('');

    if (!content.differentiationReport.passesThreshold) {
      console.log('WARNINGS:');
      content.differentiationReport.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
      console.log('');
    }

    if (!options.publishImmediately) {
      console.log('Next steps:');
      console.log('  1. Review the draft at: ' + outputPath);
      console.log('  2. Make any necessary edits');
      console.log('  3. Move to content/blog/ when ready');
      console.log('  4. Commit and push to trigger deployment');
    }

  } catch (error) {
    console.error('Generation failed:', error);
    process.exit(1);
  }
}

main();
