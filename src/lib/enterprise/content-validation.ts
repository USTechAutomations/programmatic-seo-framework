/**
 * Content Validation System
 *
 * Enforces content quality requirements for SEO blog posts:
 * - Word count minimums (2,000 words HARD minimum)
 * - Template rotation verification
 * - Cover photo validation
 * - Internal link validation
 *
 * @module content-validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { validatePhotoUrl } from './neighborhood-photo-discovery';

// =============================================================================
// CONFIGURATION - CRITICAL REQUIREMENTS
// =============================================================================

/**
 * HARD MINIMUM word count for all blog posts
 * Blogs under this count MUST NOT be published
 */
export const MINIMUM_WORD_COUNT = 2000;

/**
 * Target word count range for optimal SEO performance
 */
export const TARGET_WORD_COUNT = {
  min: 2000,
  optimal: 3000,
  max: 5000
};

/**
 * Template IDs that must be rotated
 */
export const TEMPLATE_IDS = ['ATLAS', 'PERSONA', 'CATALYST', 'PLAYBOOK', 'COMPASS', 'BLUEPRINT'];

// =============================================================================
// WORD COUNT VALIDATION
// =============================================================================

/**
 * Count words in markdown content (excluding frontmatter)
 */
export function countWords(content: string): number {
  // Remove frontmatter (between --- markers)
  let bodyContent = content;
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  if (frontmatterMatch) {
    bodyContent = content.slice(frontmatterMatch[0].length);
  }

  // Remove markdown formatting that shouldn't count as words
  bodyContent = bodyContent
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text only
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
    .replace(/^#+\s*/gm, '') // Remove heading markers
    .replace(/[*_~`]/g, '') // Remove emphasis markers
    .replace(/\|[^|]+\|/g, (match) => match.replace(/\|/g, ' ')) // Clean table cells
    .replace(/[-=]{3,}/g, '') // Remove horizontal rules
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\n+/g, ' ') // Convert newlines to spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Count words (split on whitespace)
  const words = bodyContent.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Validate word count meets minimum requirements
 */
export interface WordCountValidation {
  valid: boolean;
  wordCount: number;
  minimum: number;
  deficit: number;
  rating: 'excellent' | 'good' | 'acceptable' | 'too_short';
  message: string;
}

export function validateWordCount(content: string): WordCountValidation {
  const wordCount = countWords(content);
  const deficit = Math.max(0, MINIMUM_WORD_COUNT - wordCount);
  const valid = wordCount >= MINIMUM_WORD_COUNT;

  let rating: WordCountValidation['rating'];
  let message: string;

  if (wordCount >= TARGET_WORD_COUNT.optimal) {
    rating = 'excellent';
    message = `✅ Excellent! ${wordCount} words (optimal range)`;
  } else if (wordCount >= MINIMUM_WORD_COUNT) {
    rating = 'good';
    message = `✅ Good. ${wordCount} words meets minimum (target: ${TARGET_WORD_COUNT.optimal}+)`;
  } else if (wordCount >= MINIMUM_WORD_COUNT * 0.8) {
    rating = 'acceptable';
    message = `⚠️ Close but too short: ${wordCount} words (need ${deficit} more)`;
  } else {
    rating = 'too_short';
    message = `❌ REJECTED: ${wordCount} words is far below minimum ${MINIMUM_WORD_COUNT}`;
  }

  return {
    valid,
    wordCount,
    minimum: MINIMUM_WORD_COUNT,
    deficit,
    rating,
    message
  };
}

// =============================================================================
// TEMPLATE ROTATION VALIDATION
// =============================================================================

/**
 * Validate template selection follows rotation rules
 * - Never use same template twice in a row
 * - Never use any template from last 2 blogs
 */
export interface TemplateValidation {
  valid: boolean;
  selectedTemplate: string;
  recentHistory: string[];
  excluded: string[];
  available: string[];
  message: string;
}

export function validateTemplateSelection(
  selectedTemplate: string,
  recentHistory: string[]
): TemplateValidation {
  const lastTwo = recentHistory.slice(-2);
  const excluded = lastTwo;
  const available = TEMPLATE_IDS.filter(t => !excluded.includes(t));
  const valid = available.includes(selectedTemplate);

  let message: string;
  if (valid) {
    message = `✅ Template ${selectedTemplate} is valid (excluded: ${excluded.join(', ')})`;
  } else if (excluded.includes(selectedTemplate)) {
    message = `❌ Template ${selectedTemplate} was used recently! Use one of: ${available.join(', ')}`;
  } else {
    message = `❌ Invalid template ${selectedTemplate}. Valid templates: ${TEMPLATE_IDS.join(', ')}`;
  }

  return {
    valid,
    selectedTemplate,
    recentHistory,
    excluded,
    available,
    message
  };
}

// =============================================================================
// COVER PHOTO VALIDATION
// =============================================================================

export interface PhotoValidation {
  valid: boolean;
  url: string;
  photoId: string | null;
  httpStatus?: number;
  message: string;
}

export async function validateCoverPhoto(photoUrl: string): Promise<PhotoValidation> {
  // Extract photo ID
  const photoIdMatch = photoUrl.match(/photo-[a-zA-Z0-9_-]+/);
  const photoId = photoIdMatch ? photoIdMatch[0] : null;

  if (!photoUrl) {
    return {
      valid: false,
      url: '',
      photoId: null,
      message: '❌ No cover photo URL provided'
    };
  }

  // Validate URL is accessible
  const isValid = await validatePhotoUrl(photoUrl);

  return {
    valid: isValid,
    url: photoUrl,
    photoId,
    message: isValid
      ? `✅ Cover photo ${photoId} is accessible`
      : `❌ Cover photo ${photoId} returns 404 - find a replacement!`
  };
}

// =============================================================================
// COMPREHENSIVE CONTENT VALIDATION
// =============================================================================

export interface ContentValidationResult {
  valid: boolean;
  wordCount: WordCountValidation;
  template?: TemplateValidation;
  coverPhoto?: PhotoValidation;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive validation of blog content before publishing
 */
export async function validateContent(
  content: string,
  options?: {
    templateId?: string;
    recentTemplates?: string[];
    coverPhotoUrl?: string;
  }
): Promise<ContentValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Word count validation (REQUIRED)
  const wordCount = validateWordCount(content);
  if (!wordCount.valid) {
    errors.push(wordCount.message);
  } else if (wordCount.rating === 'good') {
    warnings.push(`Consider expanding content to ${TARGET_WORD_COUNT.optimal}+ words for better SEO`);
  }

  // Template validation (if provided)
  let template: TemplateValidation | undefined;
  if (options?.templateId && options?.recentTemplates) {
    template = validateTemplateSelection(options.templateId, options.recentTemplates);
    if (!template.valid) {
      errors.push(template.message);
    }
  }

  // Cover photo validation (if provided)
  let coverPhoto: PhotoValidation | undefined;
  if (options?.coverPhotoUrl) {
    coverPhoto = await validateCoverPhoto(options.coverPhotoUrl);
    if (!coverPhoto.valid) {
      errors.push(coverPhoto.message);
    }
  }

  return {
    valid: errors.length === 0,
    wordCount,
    template,
    coverPhoto,
    errors,
    warnings
  };
}

// =============================================================================
// FILE-BASED VALIDATION
// =============================================================================

/**
 * Validate a blog file before publishing
 */
export async function validateBlogFile(filePath: string): Promise<ContentValidationResult> {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      wordCount: {
        valid: false,
        wordCount: 0,
        minimum: MINIMUM_WORD_COUNT,
        deficit: MINIMUM_WORD_COUNT,
        rating: 'too_short',
        message: '❌ File not found'
      },
      errors: [`File not found: ${filePath}`],
      warnings: []
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Extract cover photo from frontmatter
  const photoMatch = content.match(/^featuredImage:\s*["']?([^"'\n]+)["']?/m);
  const coverPhotoUrl = photoMatch ? photoMatch[1].trim() : undefined;

  return validateContent(content, { coverPhotoUrl });
}

/**
 * Batch validate multiple blog files
 */
export async function validateBlogDirectory(
  dirPath: string
): Promise<Map<string, ContentValidationResult>> {
  const results = new Map<string, ContentValidationResult>();

  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    return results;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const result = await validateBlogFile(filePath);
    results.set(file, result);
  }

  return results;
}

// =============================================================================
// CLI HELPERS
// =============================================================================

/**
 * Print validation summary to console
 */
export function printValidationSummary(result: ContentValidationResult, filename?: string): void {
  console.log('\n' + '='.repeat(60));
  if (filename) {
    console.log(`📄 File: ${filename}`);
  }
  console.log('='.repeat(60));

  // Word count
  console.log(`\n📝 Word Count: ${result.wordCount.message}`);

  // Template
  if (result.template) {
    console.log(`📋 Template: ${result.template.message}`);
  }

  // Cover photo
  if (result.coverPhoto) {
    console.log(`🖼️  Cover Photo: ${result.coverPhoto.message}`);
  }

  // Errors
  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    result.errors.forEach(e => console.log(`   - ${e}`));
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    result.warnings.forEach(w => console.log(`   - ${w}`));
  }

  // Overall result
  console.log('\n' + (result.valid ? '✅ VALID - Ready to publish' : '❌ INVALID - Fix errors before publishing'));
  console.log('='.repeat(60) + '\n');
}

// Export for use in other modules
export {
  MINIMUM_WORD_COUNT as MIN_WORDS,
  TARGET_WORD_COUNT as TARGET_WORDS
};
