#!/usr/bin/env tsx
// =============================================================================
// batch-generate.ts - Batch Content Generation for Programmatic SEO
// =============================================================================
// Generate multiple pieces of content at scale with uniqueness guarantees.
// Reads from a content calendar/topic list and generates with deduplication.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { ContentGenerator, ContentBrief } from '../src/lib/content-generator';
import dotenv from 'dotenv';

dotenv.config();

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const BLOG_DIR = path.join(process.cwd(), 'content/blog');
const DRAFTS_DIR = path.join(process.cwd(), 'content/drafts');
const CALENDAR_FILE = path.join(process.cwd(), 'config/content-calendar.json');
const LOG_DIR = path.join(process.cwd(), 'knowledge-base/experiments');

interface ContentCalendarEntry {
  topic: string;
  keyword: string;
  intent: 'informational' | 'transactional' | 'commercial' | 'navigational';
  audience?: string;
  priority: 'high' | 'medium' | 'low';
  scheduledDate?: string;
  status: 'pending' | 'generating' | 'review' | 'published';
}

interface BatchConfig {
  maxArticlesPerRun: number;
  minHoursBetweenRuns: number;
  autoPublishThreshold: number;  // Uniqueness score threshold for auto-publish
  requireHumanReview: boolean;
}

const DEFAULT_CONFIG: BatchConfig = {
  maxArticlesPerRun: 5,
  minHoursBetweenRuns: 4,
  autoPublishThreshold: 0.85,
  requireHumanReview: true,
};

// -----------------------------------------------------------------------------
// CONTENT CALENDAR MANAGEMENT
// -----------------------------------------------------------------------------

function loadContentCalendar(): ContentCalendarEntry[] {
  if (!fs.existsSync(CALENDAR_FILE)) {
    console.log('No content calendar found. Creating sample...');
    createSampleCalendar();
  }

  return JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf8'));
}

function saveContentCalendar(entries: ContentCalendarEntry[]): void {
  fs.writeFileSync(CALENDAR_FILE, JSON.stringify(entries, null, 2));
}

function createSampleCalendar(): void {
  const sampleEntries: ContentCalendarEntry[] = [
    {
      topic: 'AI Lead Nurturing',
      keyword: 'ai lead nurturing automation',
      intent: 'informational',
      audience: 'real estate professionals',
      priority: 'high',
      status: 'pending',
    },
    {
      topic: 'CRM Automation',
      keyword: 'crm automation for small business',
      intent: 'commercial',
      audience: 'small business owners',
      priority: 'high',
      status: 'pending',
    },
    {
      topic: 'Email Marketing Automation',
      keyword: 'automated email marketing workflows',
      intent: 'informational',
      audience: 'marketing professionals',
      priority: 'medium',
      status: 'pending',
    },
    {
      topic: 'Sales Pipeline Automation',
      keyword: 'sales pipeline automation tools',
      intent: 'transactional',
      audience: 'sales teams',
      priority: 'medium',
      status: 'pending',
    },
    {
      topic: 'Customer Onboarding Automation',
      keyword: 'automated customer onboarding',
      intent: 'informational',
      audience: 'SaaS companies',
      priority: 'low',
      status: 'pending',
    },
  ];

  const configDir = path.dirname(CALENDAR_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(CALENDAR_FILE, JSON.stringify(sampleEntries, null, 2));
}

// -----------------------------------------------------------------------------
// BATCH GENERATION
// -----------------------------------------------------------------------------

async function runBatchGeneration(config: BatchConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('\n========================================');
  console.log('BATCH CONTENT GENERATION');
  console.log('========================================\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  // Load calendar and filter pending items
  let calendar = loadContentCalendar();
  const pendingItems = calendar
    .filter(item => item.status === 'pending')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, config.maxArticlesPerRun);

  if (pendingItems.length === 0) {
    console.log('No pending content items in calendar.');
    console.log('Add items to config/content-calendar.json');
    return;
  }

  console.log(`Found ${pendingItems.length} items to generate\n`);

  // Initialize generator
  const generator = new ContentGenerator(apiKey, BLOG_DIR);
  await generator.initialize();

  const results: {
    topic: string;
    success: boolean;
    slug?: string;
    score?: number;
    error?: string;
  }[] = [];

  // Process each item
  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    console.log(`\n[${i + 1}/${pendingItems.length}] Generating: ${item.topic}`);
    console.log(`    Keyword: ${item.keyword}`);
    console.log(`    Intent: ${item.intent}`);

    try {
      // Update status
      const calendarIndex = calendar.findIndex(c => c.keyword === item.keyword);
      if (calendarIndex !== -1) {
        calendar[calendarIndex].status = 'generating';
        saveContentCalendar(calendar);
      }

      // Generate brief
      const brief = await generator.generateBrief(
        item.topic,
        item.keyword,
        item.intent,
        item.audience || 'business professionals'
      );

      console.log(`    Angle: ${brief.contentAngle}`);

      // Generate content
      let content = await generator.generateContent(brief);

      // Regenerate if needed
      if (!content.differentiationReport.passesThreshold) {
        console.log('    Below threshold, regenerating...');
        content = await generator.regenerateIfNeeded(content, brief);
      }

      // Determine output location
      const shouldAutoPublish =
        !config.requireHumanReview &&
        content.uniquenessScore >= config.autoPublishThreshold;

      const outputDir = shouldAutoPublish ? BLOG_DIR : DRAFTS_DIR;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save content
      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-${content.slug}.md`;
      const outputPath = path.join(outputDir, filename);

      const frontmatter = `---
title: "${content.title}"
description: "${content.metaDescription}"
date: ${date}
author: "US Tech Automations"
tags: ${JSON.stringify(item.topic.split(' ').slice(0, 4))}
slug: "${content.slug}"
category: "${item.topic.split(' ')[0]}"
draft: ${!shouldAutoPublish}
autoGenerated: true
templateType: "programmatic-seo"
contentHash: "${content.contentHash}"
uniquenessScore: ${content.uniquenessScore.toFixed(2)}
qualityScore: ${content.qualityScore.toFixed(2)}
faqItems:
${content.faqItems.map(faq => `  - question: "${faq.question}"
    answer: "${faq.answer.replace(/"/g, '\\"')}"`).join('\n')}
---

`;

      fs.writeFileSync(outputPath, frontmatter + content.content);

      // Update calendar status
      if (calendarIndex !== -1) {
        calendar[calendarIndex].status = shouldAutoPublish ? 'published' : 'review';
        saveContentCalendar(calendar);
      }

      results.push({
        topic: item.topic,
        success: true,
        slug: content.slug,
        score: content.uniquenessScore,
      });

      console.log(`    Success! Score: ${(content.uniquenessScore * 100).toFixed(1)}%`);
      console.log(`    Output: ${outputPath}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`    Failed: ${errorMessage}`);

      // Update calendar status
      const calendarIndex = calendar.findIndex(c => c.keyword === item.keyword);
      if (calendarIndex !== -1) {
        calendar[calendarIndex].status = 'pending';  // Reset for retry
        saveContentCalendar(calendar);
      }

      results.push({
        topic: item.topic,
        success: false,
        error: errorMessage,
      });
    }

    // Rate limiting between generations
    if (i < pendingItems.length - 1) {
      console.log('    Waiting 5 seconds before next generation...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('BATCH GENERATION COMPLETE');
  console.log('========================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => {
    console.log(`  - ${r.topic} (${r.slug}, ${(r.score! * 100).toFixed(1)}%)`);
  });

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}/${results.length}`);
    failed.forEach(r => {
      console.log(`  - ${r.topic}: ${r.error}`);
    });
  }

  // Save batch log
  const logEntry = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    successful: successful.length,
    failed: failed.length,
    results,
  };

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const logFile = path.join(LOG_DIR, 'batch-generation-log.json');
  let existingLog: any[] = [];
  if (fs.existsSync(logFile)) {
    existingLog = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  }
  existingLog.unshift(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(existingLog.slice(0, 100), null, 2));

  console.log(`\nLog saved to: ${logFile}`);
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const config: BatchConfig = { ...DEFAULT_CONFIG };

  // Parse arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];

    switch (key) {
      case 'max':
        config.maxArticlesPerRun = parseInt(value, 10);
        break;
      case 'auto-publish':
        config.requireHumanReview = value !== 'true';
        break;
      case 'threshold':
        config.autoPublishThreshold = parseFloat(value);
        break;
    }
  }

  await runBatchGeneration(config);
}

main().catch(err => {
  console.error('Batch generation failed:', err);
  process.exit(1);
});
