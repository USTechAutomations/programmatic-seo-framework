#!/usr/bin/env tsx
// =============================================================================
// generate-local.ts - Content Generation with Local Ollama Models
// =============================================================================
// Generate blog content using locally running Ollama models.
// No API keys required - runs entirely on your machine.
//
// Usage:
//   npm run generate:local -- --topic "AI Lead Nurturing" --keyword "ai lead nurturing"
//   npm run generate:local -- --topic "CRM Automation" --keyword "crm automation" --model nemotron-3-nano:30b-a3b-fp16
// =============================================================================

import fs from 'fs';
import path from 'path';
import { OllamaContentGenerator, ContentBrief, GeneratedContent } from '../src/lib/content-generator-ollama';
import { OllamaClient, RECOMMENDED_MODELS } from '../src/lib/ollama-client';

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
  model: string;
  publishImmediately: boolean;
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
    audience: 'business professionals',
    model: RECOMMENDED_MODELS.balanced,
    publishImmediately: false,
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
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
      case 'model':
        options.model = value;
        break;
      case 'publish':
        options.publishImmediately = value === 'true';
        break;
    }
  }

  return options;
}

// -----------------------------------------------------------------------------
// CONTENT GENERATION
// -----------------------------------------------------------------------------

async function generateContent(options: GenerationOptions): Promise<GeneratedContent> {
  console.log('\n========================================');
  console.log('LOCAL CONTENT GENERATION (Ollama)');
  console.log('========================================\n');

  // Check Ollama connection and list models
  const client = new OllamaClient();
  const connected = await client.checkConnection();

  if (!connected) {
    console.error('ERROR: Cannot connect to Ollama.');
    console.error('Make sure Ollama is running: ollama serve');
    process.exit(1);
  }

  const availableModels = await client.listModels();
  console.log('Available models:', availableModels.join(', '));
  console.log(`Using model: ${options.model}\n`);

  if (!availableModels.includes(options.model)) {
    console.warn(`Warning: Model "${options.model}" not found. Available: ${availableModels.join(', ')}`);
    console.warn(`Attempting to use anyway...`);
  }

  console.log(`Topic: ${options.topic}`);
  console.log(`Keyword: ${options.keyword}`);
  console.log(`Intent: ${options.intent}`);
  console.log(`Audience: ${options.audience}`);
  console.log('');

  // Initialize generator
  const generator = new OllamaContentGenerator(BLOG_DIR, options.model);
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

  console.log('[2/4] Generating content (this may take several minutes)...');
  let content = await generator.generateContent(brief);

  console.log(`      Initial uniqueness score: ${(content.uniquenessScore * 100).toFixed(1)}%`);
  console.log(`      Word count: ${content.wordCount}`);
  console.log('');

  // Check if regeneration needed
  if (!content.differentiationReport.passesThreshold) {
    console.log('[3/4] Content below threshold, attempting improvement...');
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

  const outputDir = options.publishImmediately ? BLOG_DIR : DRAFTS_DIR;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

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
generatedBy: "${content.generatedBy}"
templateType: "programmatic-seo-local"
contentHash: "${content.contentHash}"
uniquenessScore: ${content.uniquenessScore.toFixed(2)}
qualityScore: ${content.qualityScore.toFixed(2)}
faqItems:
${content.faqItems?.map(faq => `  - question: "${faq.question}"
    answer: "${faq.answer?.replace(/"/g, '\\"') || ''}"`).join('\n') || '  []'}
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
    model: options.model,
    generatedBy: content.generatedBy,
    slug: content.slug,
    wordCount: content.wordCount,
    uniquenessScore: content.uniquenessScore,
    qualityScore: content.qualityScore,
    differentiationReport: content.differentiationReport,
    outputPath,
    status: options.publishImmediately ? 'published' : 'draft',
  };

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const logFile = path.join(LOG_DIR, 'local-generation-log.json');
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
      console.log('Programmatic SEO Framework - Local Content Generation');
      console.log('');
      console.log('Usage:');
      console.log('  npm run generate:local -- --topic "Topic" --keyword "keyword"');
      console.log('');
      console.log('Options:');
      console.log('  --topic      Main topic of the content (required)');
      console.log('  --keyword    Target SEO keyword (required)');
      console.log('  --intent     Search intent (informational|transactional|commercial|navigational)');
      console.log('  --audience   Target audience description');
      console.log('  --model      Ollama model to use (default: qwen2.5:7b-instruct)');
      console.log('  --publish    Publish immediately without review (true|false)');
      console.log('');
      console.log('Available models:');
      console.log(`  Premium:  ${RECOMMENDED_MODELS.premium}`);
      console.log(`  Balanced: ${RECOMMENDED_MODELS.balanced}`);
      console.log(`  Fast:     ${RECOMMENDED_MODELS.fast}`);
      console.log('');
      console.log('Examples:');
      console.log('  npm run generate:local -- --topic "Email Marketing" --keyword "email marketing automation"');
      console.log('  npm run generate:local -- --topic "CRM Tools" --keyword "crm for small business" --model nemotron-3-nano:30b-a3b-fp16');
      process.exit(1);
    }

    const startTime = Date.now();
    const content = await generateContent(options);
    const outputPath = saveContent(content, options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

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
    console.log(`Model: ${content.generatedBy}`);
    console.log(`Duration: ${duration}s`);
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
    console.error('\nGeneration failed:', error);
    process.exit(1);
  }
}

main();
