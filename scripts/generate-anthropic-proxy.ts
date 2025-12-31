#!/usr/bin/env tsx
// =============================================================================
// generate-anthropic-proxy.ts - Content Generation via LiteLLM Proxy
// =============================================================================
// Uses the local LiteLLM proxy to access Claude Max plan
// =============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BLOG_DIR = path.join(process.cwd(), 'content/blog');
const DRAFTS_DIR = path.join(process.cwd(), 'content/drafts');
const LOG_DIR = path.join(process.cwd(), 'knowledge-base/experiments');

// Proxy configuration
const PROXY_URL = process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
const PROXY_MODEL = process.env.LITELLM_MODEL || 'claude-sonnet-4-20250514';

interface GenerationOptions {
  topic: string;
  keyword: string;
  intent: string;
  audience: string;
}

function parseArgs(): GenerationOptions {
  const args = process.argv.slice(2);
  const options: GenerationOptions = {
    topic: '',
    keyword: '',
    intent: 'informational',
    audience: 'business professionals',
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      (options as any)[key] = value;
    }
  }

  return options;
}

async function callProxy(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
  const body: any = {
    model: PROXY_MODEL,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    max_tokens: 8000,
    temperature: 0.7,
  };

  const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dummy', // Proxy may not need real auth
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractJSON(text: string): any {
  const patterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /\{[\s\S]*\}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const jsonStr = match[1] || match[0];
        return JSON.parse(jsonStr.trim());
      } catch {
        continue;
      }
    }
  }

  try {
    return JSON.parse(text.trim());
  } catch {
    throw new Error('Could not extract valid JSON from response');
  }
}

async function generateContent(options: GenerationOptions) {
  console.log('\n========================================');
  console.log('ANTHROPIC CONTENT GENERATION (via Proxy)');
  console.log('========================================\n');

  console.log(`Proxy URL: ${PROXY_URL}`);
  console.log(`Model: ${PROXY_MODEL}`);
  console.log(`Topic: ${options.topic}`);
  console.log(`Keyword: ${options.keyword}`);
  console.log(`Intent: ${options.intent}`);
  console.log(`Audience: ${options.audience}`);
  console.log('');

  // Generate brief components
  console.log('[1/4] Generating content brief...');

  const diffPrompt = `You are a content strategist. For the topic "${options.topic}", generate 5 unique differentiators that would make an article stand out. Return ONLY a JSON array of 5 strings.`;
  const diffResponse = await callProxy([{ role: 'user', content: diffPrompt }]);

  let differentiators: string[];
  try {
    differentiators = extractJSON(diffResponse);
  } catch {
    differentiators = ['Unique perspective', 'Actionable insights', 'Real case studies', 'Expert analysis', 'Future trends'];
  }

  const dataPrompt = `For an article about "${options.topic}" targeting "${options.keyword}", provide 5 specific, verifiable data points. Return ONLY valid JSON: [{"fact": "...", "source": "..."}]`;
  const dataResponse = await callProxy([{ role: 'user', content: dataPrompt }]);

  let dataPoints: { fact: string; source: string }[];
  try {
    dataPoints = extractJSON(dataResponse);
  } catch {
    dataPoints = [
      { fact: 'Industry adoption is growing rapidly', source: 'Industry Report 2024' },
      { fact: 'ROI improvements average 30-50%', source: 'Market Analysis' },
    ];
  }

  const insightPrompt = `What is ONE unique insight about "${options.topic}" that most articles miss? Be specific in 2-3 sentences.`;
  const uniqueInsight = await callProxy([{ role: 'user', content: insightPrompt }]);

  console.log(`      Differentiators: ${differentiators.length}`);
  console.log(`      Data points: ${dataPoints.length}`);
  console.log('');

  // Generate main content
  console.log('[2/4] Generating content...');

  const systemPrompt = `You are an expert content writer specializing in ${options.topic}.
You write for ${options.audience}. Your content is:
- Genuinely valuable and actionable
- Based on real data and expert insights
- Unique in perspective and approach
- Optimized for both humans and search engines
- Structured for AI Overviews and featured snippets

CRITICAL RULES:
1. NEVER use generic filler content
2. EVERY paragraph must add unique value
3. Include specific examples
4. First paragraph must directly answer the search intent
5. Minimum 2000 words`;

  const contentPrompt = `Write a comprehensive article for:

TOPIC: ${options.topic}
TARGET KEYWORD: ${options.keyword}
SEARCH INTENT: ${options.intent}
AUDIENCE: ${options.audience}

DIFFERENTIATORS TO INCORPORATE:
${differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}

DATA POINTS TO INCLUDE:
${dataPoints.map((d, i) => `${i + 1}. ${d.fact} (Source: ${d.source})`).join('\n')}

UNIQUE INSIGHT:
${uniqueInsight}

REQUIREMENTS:
- Minimum 2000 words
- Use H2 (##) and H3 (###) headers
- Include a FAQ section with 5 questions
- First paragraph must answer the search query directly
- Include actionable takeaways
- End with clear call to action

Return ONLY valid JSON:
{
  "title": "SEO-optimized title under 60 chars",
  "metaDescription": "Meta description under 155 chars",
  "slug": "url-friendly-slug",
  "content": "Full markdown content",
  "faqItems": [{"question": "Q", "answer": "A"}]
}`;

  const contentResponse = await callProxy([{ role: 'user', content: contentPrompt }], systemPrompt);

  let generatedData;
  try {
    generatedData = extractJSON(contentResponse);
  } catch {
    console.log('  JSON parsing failed, using response as content');
    generatedData = {
      title: `${options.topic}: Complete Guide`,
      metaDescription: `Learn everything about ${options.topic} for ${options.audience}.`,
      slug: options.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      content: contentResponse,
      faqItems: [],
    };
  }

  const wordCount = generatedData.content.split(/\s+/).length;
  console.log(`      Word count: ${wordCount}`);
  console.log('');

  console.log('[3/4] Evaluating quality...');
  const contentHash = crypto.createHash('sha256').update(generatedData.content).digest('hex').substring(0, 16);

  // Simple quality scoring
  const h2Count = (generatedData.content.match(/^## /gm) || []).length;
  const h3Count = (generatedData.content.match(/^### /gm) || []).length;
  const listCount = (generatedData.content.match(/^[*-] /gm) || []).length;

  let qualityScore = 0;
  if (wordCount >= 2000) qualityScore += 0.3;
  else if (wordCount >= 1500) qualityScore += 0.2;
  if (h2Count >= 3) qualityScore += 0.2;
  if (h3Count >= 2) qualityScore += 0.1;
  if (listCount >= 3) qualityScore += 0.1;
  if (generatedData.faqItems?.length >= 3) qualityScore += 0.15;
  if (generatedData.content.includes(options.keyword)) qualityScore += 0.15;

  console.log(`      Quality score: ${(qualityScore * 100).toFixed(1)}%`);
  console.log('');

  console.log('[4/4] Saving content...');

  // Save content
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${generatedData.slug}.md`;

  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }

  const frontmatter = `---
title: "${generatedData.title}"
description: "${generatedData.metaDescription}"
date: ${date}
author: "US Tech Automations"
tags: ${JSON.stringify(options.topic.split(' ').slice(0, 4))}
slug: "${generatedData.slug}"
category: "${options.topic.split(' ')[0]}"
draft: true
autoGenerated: true
generatedBy: "anthropic-proxy (${PROXY_MODEL})"
contentHash: "${contentHash}"
qualityScore: ${qualityScore.toFixed(2)}
faqItems:
${generatedData.faqItems?.map((faq: any) => `  - question: "${faq.question}"
    answer: "${faq.answer?.replace(/"/g, '\\"') || ''}"`).join('\n') || '  []'}
---

`;

  const fullContent = frontmatter + generatedData.content;
  const outputPath = path.join(DRAFTS_DIR, filename);
  fs.writeFileSync(outputPath, fullContent);

  // Log generation
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  const logFile = path.join(LOG_DIR, 'anthropic-generation-log.json');
  const logEntry = {
    timestamp: new Date().toISOString(),
    topic: options.topic,
    keyword: options.keyword,
    model: PROXY_MODEL,
    wordCount,
    qualityScore,
    outputPath,
  };
  let existingLog: any[] = [];
  if (fs.existsSync(logFile)) {
    existingLog = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  }
  existingLog.unshift(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(existingLog.slice(0, 100), null, 2));

  console.log('');
  console.log('========================================');
  console.log('GENERATION COMPLETE');
  console.log('========================================');
  console.log('');
  console.log(`Title: ${generatedData.title}`);
  console.log(`Slug: ${generatedData.slug}`);
  console.log(`Words: ${wordCount}`);
  console.log(`Quality: ${(qualityScore * 100).toFixed(1)}%`);
  console.log(`Model: ${PROXY_MODEL}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  return outputPath;
}

async function main() {
  const options = parseArgs();

  if (!options.topic || !options.keyword) {
    console.log('Usage: tsx scripts/generate-anthropic-proxy.ts --topic "Topic" --keyword "keyword"');
    process.exit(1);
  }

  try {
    await generateContent(options);
  } catch (error) {
    console.error('Generation failed:', error);
    process.exit(1);
  }
}

main();
