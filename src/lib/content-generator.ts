// =============================================================================
// content-generator.ts - AI Content Generation with Uniqueness Enforcement
// =============================================================================
// This is the core of the programmatic SEO system. It ensures every piece of
// content is genuinely unique and valuable, not just template variations.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

export interface ContentBrief {
  topic: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  audience: string;
  contentAngle: string;           // Unique angle for THIS specific piece
  differentiators: string[];      // What makes THIS different from others
  dataPoints: DataPoint[];        // Unique data/facts to include
  uniqueInsight: string;          // The one insight only this article has
  contentLength: 'short' | 'medium' | 'long' | 'comprehensive';
}

export interface DataPoint {
  fact: string;
  source: string;
  verified: boolean;
}

export interface GeneratedContent {
  title: string;
  metaDescription: string;
  slug: string;
  content: string;
  faqItems: { question: string; answer: string }[];
  wordCount: number;
  uniquenessScore: number;
  qualityScore: number;
  contentHash: string;
  differentiationReport: DifferentiationReport;
}

export interface DifferentiationReport {
  uniqueFactCount: number;
  uniquePhrases: string[];
  angleScore: number;           // How unique is the perspective
  dataScore: number;            // How much unique data included
  insightScore: number;         // Quality of unique insights
  overallScore: number;
  passesThreshold: boolean;
  issues: string[];
}

export interface ContentCluster {
  pillarTopic: string;
  clusterPosts: ContentBrief[];
  differentiationMatrix: Map<string, Set<string>>; // Track what angles/data used
}

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const CONFIG = {
  minUniquenessScore: 0.75,      // Minimum 75% unique vs existing content
  minQualityScore: 0.8,          // Minimum quality threshold
  minWordCount: 1500,            // Minimum words for substance
  maxSimilarity: 0.3,            // Max 30% similarity to any existing post
  requiredUniqueDataPoints: 3,   // Must have at least 3 unique facts
  requiredUniquePhrases: 5,      // Must have 5 unique key phrases
};

// Existing content fingerprints for similarity checking
const contentFingerprints: Map<string, Set<string>> = new Map();

// -----------------------------------------------------------------------------
// CONTENT ANGLE STRATEGIES
// -----------------------------------------------------------------------------

const CONTENT_ANGLES = {
  informational: [
    'beginner-guide',           // Complete newcomer perspective
    'expert-deep-dive',         // Technical expert analysis
    'case-study',               // Real-world example focus
    'comparison',               // Versus/alternative analysis
    'step-by-step',             // Tactical how-to
    'common-mistakes',          // What NOT to do
    'future-trends',            // Forward-looking analysis
    'data-analysis',            // Statistics and research focus
    'interview-synthesis',      // Expert opinions compiled
    'contrarian-view',          // Challenging common assumptions
  ],
  transactional: [
    'roi-focused',              // Return on investment analysis
    'implementation-guide',     // How to get started
    'feature-breakdown',        // Detailed capability analysis
    'pricing-analysis',         // Cost/value assessment
    'use-case-specific',        // Industry/role specific
  ],
  commercial: [
    'buyer-guide',              // Decision framework
    'alternatives-analysis',    // Competitor comparison
    'pros-cons',                // Balanced evaluation
    'industry-specific',        // Vertical focus
  ],
};

// -----------------------------------------------------------------------------
// UNIQUENESS ENGINE
// -----------------------------------------------------------------------------

export class UniquenessEngine {
  private existingContent: Map<string, string[]> = new Map();
  private usedAngles: Map<string, Set<string>> = new Map();
  private usedDataPoints: Set<string> = new Set();

  async loadExistingContent(blogDir: string): Promise<void> {
    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

      // Extract key phrases (3-5 word combinations)
      const phrases = this.extractKeyPhrases(content);
      this.existingContent.set(slug, phrases);

      // Track fingerprint
      contentFingerprints.set(slug, new Set(phrases));
    }
  }

  private extractKeyPhrases(content: string): string[] {
    // Remove markdown syntax
    const plainText = content
      .replace(/^---[\s\S]*?---/, '')  // Remove frontmatter
      .replace(/[#*_`\[\]()]/g, ' ')    // Remove markdown
      .toLowerCase();

    // Extract 3-5 word phrases
    const words = plainText.split(/\s+/).filter(w => w.length > 3);
    const phrases: string[] = [];

    for (let i = 0; i < words.length - 4; i++) {
      phrases.push(words.slice(i, i + 4).join(' '));
    }

    return phrases;
  }

  calculateSimilarity(newContent: string, existingSlug: string): number {
    const existingPhrases = this.existingContent.get(existingSlug);
    if (!existingPhrases) return 0;

    const newPhrases = new Set(this.extractKeyPhrases(newContent));
    const existingSet = new Set(existingPhrases);

    let overlap = 0;
    for (const phrase of newPhrases) {
      if (existingSet.has(phrase)) overlap++;
    }

    return overlap / Math.max(newPhrases.size, 1);
  }

  calculateOverallSimilarity(newContent: string): { maxSimilarity: number; mostSimilarTo: string } {
    let maxSimilarity = 0;
    let mostSimilarTo = '';

    for (const [slug] of this.existingContent) {
      const similarity = this.calculateSimilarity(newContent, slug);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarTo = slug;
      }
    }

    return { maxSimilarity, mostSimilarTo };
  }

  registerAngle(topic: string, angle: string): void {
    if (!this.usedAngles.has(topic)) {
      this.usedAngles.set(topic, new Set());
    }
    this.usedAngles.get(topic)!.add(angle);
  }

  getAvailableAngles(topic: string, intent: keyof typeof CONTENT_ANGLES): string[] {
    const usedForTopic = this.usedAngles.get(topic) || new Set();
    const allAngles = CONTENT_ANGLES[intent] || CONTENT_ANGLES.informational;
    return allAngles.filter(angle => !usedForTopic.has(angle));
  }

  registerDataPoint(fact: string): void {
    this.usedDataPoints.add(this.normalizeDataPoint(fact));
  }

  isDataPointUnique(fact: string): boolean {
    return !this.usedDataPoints.has(this.normalizeDataPoint(fact));
  }

  private normalizeDataPoint(fact: string): string {
    return fact.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 100);
  }
}

// -----------------------------------------------------------------------------
// CONTENT GENERATOR
// -----------------------------------------------------------------------------

export class ContentGenerator {
  private client: Anthropic;
  private uniquenessEngine: UniquenessEngine;
  private blogDir: string;

  constructor(apiKey: string, blogDir: string) {
    this.client = new Anthropic({ apiKey });
    this.uniquenessEngine = new UniquenessEngine();
    this.blogDir = blogDir;
  }

  async initialize(): Promise<void> {
    await this.uniquenessEngine.loadExistingContent(this.blogDir);
  }

  async generateBrief(
    topic: string,
    keyword: string,
    intent: 'informational' | 'transactional' | 'navigational' | 'commercial',
    audience: string
  ): Promise<ContentBrief> {
    // Get unused angle for this topic
    const availableAngles = this.uniquenessEngine.getAvailableAngles(topic, intent);

    if (availableAngles.length === 0) {
      throw new Error(`All content angles exhausted for topic: ${topic}. Consider a new topic cluster.`);
    }

    const contentAngle = availableAngles[0];

    // Generate unique differentiators using AI
    const differentiatorPrompt = `
You are a content strategist. For the topic "${topic}" with the angle "${contentAngle}",
generate 5 unique differentiators that would make this article stand out from typical
articles on this topic. These should be specific, actionable, and genuinely valuable.

Audience: ${audience}
Keyword: ${keyword}
Intent: ${intent}

Return as JSON array of strings.
`;

    const diffResponse = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: differentiatorPrompt }],
    });

    const differentiators = JSON.parse(
      (diffResponse.content[0] as { type: string; text: string }).text
    );

    // Generate unique data points
    const dataPointPrompt = `
For an article about "${topic}" targeting "${keyword}", provide 5 unique, verifiable
data points or statistics that would add genuine value. Each should be specific,
recent (2023-2024 preferred), and cite-able.

Return as JSON array with format: [{"fact": "...", "source": "...", "verified": false}]
`;

    const dataResponse = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: dataPointPrompt }],
    });

    const dataPoints = JSON.parse(
      (dataResponse.content[0] as { type: string; text: string }).text
    );

    // Generate unique insight
    const insightPrompt = `
What is ONE unique insight about "${topic}" that most articles miss? This should be
a genuinely valuable perspective that would make someone think "I never considered that."

Keep it to 2-3 sentences. Be specific, not generic.
`;

    const insightResponse = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: insightPrompt }],
    });

    const uniqueInsight = (insightResponse.content[0] as { type: string; text: string }).text;

    // Register the angle as used
    this.uniquenessEngine.registerAngle(topic, contentAngle);

    return {
      topic,
      targetKeyword: keyword,
      secondaryKeywords: [],
      searchIntent: intent,
      audience,
      contentAngle,
      differentiators,
      dataPoints,
      uniqueInsight,
      contentLength: 'long',
    };
  }

  async generateContent(brief: ContentBrief): Promise<GeneratedContent> {
    const systemPrompt = `You are an expert content writer specializing in ${brief.topic}.
You write for ${brief.audience}. Your content is:
- Genuinely valuable and actionable
- Based on real data and expert insights
- Unique in perspective and approach
- Optimized for both humans and search engines
- Structured for Answer Engine Optimization (AI Overviews)

CRITICAL RULES:
1. NEVER use generic filler content
2. EVERY paragraph must add unique value
3. Include specific examples, not vague statements
4. Use the unique data points provided - don't make up statistics
5. Write from the specific angle provided - don't be generic
6. First paragraph must directly answer the search intent
7. Include the unique insight naturally in the content`;

    const contentPrompt = `
Write a comprehensive article for the following brief:

TOPIC: ${brief.topic}
TARGET KEYWORD: ${brief.targetKeyword}
SEARCH INTENT: ${brief.searchIntent}
CONTENT ANGLE: ${brief.contentAngle}
AUDIENCE: ${brief.audience}

UNIQUE DIFFERENTIATORS TO INCORPORATE:
${brief.differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}

DATA POINTS TO INCLUDE (USE THESE EXACT FACTS):
${brief.dataPoints.map((d, i) => `${i + 1}. ${d.fact} (Source: ${d.source})`).join('\n')}

UNIQUE INSIGHT TO WEAVE IN:
${brief.uniqueInsight}

REQUIREMENTS:
- Minimum 2000 words
- Use H2 and H3 headers for structure
- Include a FAQ section with 5 unique questions
- First paragraph must answer the search query directly
- Include actionable takeaways
- End with a clear call to action

FORMAT: Return as JSON with this structure:
{
  "title": "SEO-optimized title (under 60 chars)",
  "metaDescription": "Compelling meta description (under 155 chars)",
  "slug": "url-friendly-slug",
  "content": "Full markdown content",
  "faqItems": [{"question": "...", "answer": "..."}]
}
`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentPrompt }],
    });

    const generatedData = JSON.parse(
      (response.content[0] as { type: string; text: string }).text
    );

    // Calculate uniqueness and quality scores
    const differentiationReport = await this.evaluateDifferentiation(
      generatedData.content,
      brief
    );

    // Calculate content hash for deduplication
    const contentHash = crypto
      .createHash('sha256')
      .update(generatedData.content)
      .digest('hex')
      .substring(0, 16);

    // Count words
    const wordCount = generatedData.content.split(/\s+/).length;

    return {
      ...generatedData,
      wordCount,
      uniquenessScore: differentiationReport.overallScore,
      qualityScore: await this.evaluateQuality(generatedData.content, brief),
      contentHash,
      differentiationReport,
    };
  }

  private async evaluateDifferentiation(
    content: string,
    brief: ContentBrief
  ): Promise<DifferentiationReport> {
    // Check similarity against existing content
    const { maxSimilarity, mostSimilarTo } =
      this.uniquenessEngine.calculateOverallSimilarity(content);

    // Count unique data points used
    let uniqueFactCount = 0;
    for (const dp of brief.dataPoints) {
      if (content.toLowerCase().includes(dp.fact.toLowerCase().substring(0, 50))) {
        uniqueFactCount++;
      }
    }

    // Extract unique phrases not in existing content
    const contentPhrases = content
      .toLowerCase()
      .split(/[.!?]/)
      .filter(s => s.length > 50)
      .slice(0, 10);

    const uniquePhrases = contentPhrases.filter(phrase => {
      for (const [, existing] of contentFingerprints) {
        for (const existingPhrase of existing) {
          if (phrase.includes(existingPhrase)) return false;
        }
      }
      return true;
    });

    // Calculate scores
    const angleScore = 1 - maxSimilarity;
    const dataScore = uniqueFactCount / Math.max(brief.dataPoints.length, 1);
    const insightScore = content.toLowerCase().includes(
      brief.uniqueInsight.toLowerCase().substring(0, 50)
    ) ? 1 : 0;

    const overallScore = (angleScore * 0.4) + (dataScore * 0.35) + (insightScore * 0.25);

    // Identify issues
    const issues: string[] = [];
    if (maxSimilarity > CONFIG.maxSimilarity) {
      issues.push(`Too similar to existing post: ${mostSimilarTo} (${(maxSimilarity * 100).toFixed(1)}%)`);
    }
    if (uniqueFactCount < CONFIG.requiredUniqueDataPoints) {
      issues.push(`Only ${uniqueFactCount}/${CONFIG.requiredUniqueDataPoints} required data points included`);
    }
    if (uniquePhrases.length < CONFIG.requiredUniquePhrases) {
      issues.push(`Only ${uniquePhrases.length}/${CONFIG.requiredUniquePhrases} unique key phrases`);
    }

    return {
      uniqueFactCount,
      uniquePhrases: uniquePhrases.slice(0, 5),
      angleScore,
      dataScore,
      insightScore,
      overallScore,
      passesThreshold: overallScore >= CONFIG.minUniquenessScore && issues.length === 0,
      issues,
    };
  }

  private async evaluateQuality(content: string, brief: ContentBrief): Promise<number> {
    const evaluationPrompt = `
Rate this content on a scale of 0-1 for each criterion. Return JSON only.

CONTENT TO EVALUATE:
${content.substring(0, 3000)}...

ORIGINAL BRIEF:
- Topic: ${brief.topic}
- Keyword: ${brief.targetKeyword}
- Audience: ${brief.audience}
- Required angle: ${brief.contentAngle}

CRITERIA:
1. answersIntent: Does it directly answer the search intent?
2. actionability: Are there specific, actionable takeaways?
3. depth: Is the analysis substantive, not surface-level?
4. accuracy: Do claims appear accurate and well-sourced?
5. readability: Is it well-structured and easy to follow?
6. uniqueness: Does it offer a fresh perspective?

Return: {"answersIntent": 0.0-1.0, "actionability": 0.0-1.0, ...}
`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: evaluationPrompt }],
    });

    const scores = JSON.parse(
      (response.content[0] as { type: string; text: string }).text
    );

    // Weighted average
    const weights = {
      answersIntent: 0.25,
      actionability: 0.2,
      depth: 0.2,
      accuracy: 0.15,
      readability: 0.1,
      uniqueness: 0.1,
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      totalScore += (scores[key] || 0) * weight;
    }

    return totalScore;
  }

  async regenerateIfNeeded(
    content: GeneratedContent,
    brief: ContentBrief,
    maxAttempts = 3
  ): Promise<GeneratedContent> {
    let current = content;
    let attempts = 0;

    while (!current.differentiationReport.passesThreshold && attempts < maxAttempts) {
      attempts++;
      console.log(`Content failed differentiation check. Attempt ${attempts}/${maxAttempts}`);
      console.log(`Issues: ${current.differentiationReport.issues.join(', ')}`);

      // Modify brief to address issues
      const modifiedBrief = { ...brief };

      // Add more emphasis on uniqueness
      modifiedBrief.contentAngle = `${brief.contentAngle}-v${attempts + 1}`;

      // Request different data points
      modifiedBrief.dataPoints = await this.getAlternativeDataPoints(brief.topic);

      current = await this.generateContent(modifiedBrief);
    }

    if (!current.differentiationReport.passesThreshold) {
      throw new Error(
        `Failed to generate sufficiently unique content after ${maxAttempts} attempts. ` +
        `Issues: ${current.differentiationReport.issues.join(', ')}`
      );
    }

    return current;
  }

  private async getAlternativeDataPoints(topic: string): Promise<DataPoint[]> {
    const prompt = `
Provide 5 DIFFERENT and UNIQUE data points about "${topic}" that are:
- Not commonly cited
- From recent research (2023-2024)
- Verifiable with sources
- Specific numbers or percentages

Return as JSON: [{"fact": "...", "source": "...", "verified": false}]
`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(
      (response.content[0] as { type: string; text: string }).text
    );
  }
}

// -----------------------------------------------------------------------------
// EXPORT
// -----------------------------------------------------------------------------

export const createContentGenerator = (apiKey: string, blogDir: string) => {
  return new ContentGenerator(apiKey, blogDir);
};
