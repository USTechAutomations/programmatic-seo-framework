// =============================================================================
// content-generator-ollama.ts - Local LLM Content Generation
// =============================================================================
// Content generation using locally running Ollama models.
// Provides the same interface as the Anthropic version but runs entirely local.
// =============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { OllamaClient, extractJSON, RECOMMENDED_MODELS } from './ollama-client';

// Re-export types from the main content generator
export interface ContentBrief {
  topic: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  audience: string;
  contentAngle: string;
  differentiators: string[];
  dataPoints: DataPoint[];
  uniqueInsight: string;
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
  generatedBy: string;  // Track which model was used
}

export interface DifferentiationReport {
  uniqueFactCount: number;
  uniquePhrases: string[];
  angleScore: number;
  dataScore: number;
  insightScore: number;
  overallScore: number;
  passesThreshold: boolean;
  issues: string[];
}

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const CONFIG = {
  minUniquenessScore: 0.75,
  minQualityScore: 0.8,
  minWordCount: 1500,
  maxSimilarity: 0.3,
  requiredUniqueDataPoints: 3,
  requiredUniquePhrases: 5,
};

const CONTENT_ANGLES = {
  informational: [
    'beginner-guide',
    'expert-deep-dive',
    'case-study',
    'comparison',
    'step-by-step',
    'common-mistakes',
    'future-trends',
    'data-analysis',
    'interview-synthesis',
    'contrarian-view',
  ],
  transactional: [
    'roi-focused',
    'implementation-guide',
    'feature-breakdown',
    'pricing-analysis',
    'use-case-specific',
  ],
  commercial: [
    'buyer-guide',
    'alternatives-analysis',
    'pros-cons',
    'industry-specific',
  ],
  navigational: [
    'getting-started',
    'quick-reference',
    'troubleshooting',
  ],
};

// -----------------------------------------------------------------------------
// UNIQUENESS ENGINE (Same as main generator)
// -----------------------------------------------------------------------------

class UniquenessEngine {
  private existingContent: Map<string, string[]> = new Map();
  private usedAngles: Map<string, Set<string>> = new Map();
  private usedDataPoints: Set<string> = new Set();

  async loadExistingContent(blogDir: string): Promise<void> {
    if (!fs.existsSync(blogDir)) return;

    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
      const phrases = this.extractKeyPhrases(content);
      this.existingContent.set(slug, phrases);
    }
  }

  private extractKeyPhrases(content: string): string[] {
    const plainText = content
      .replace(/^---[\s\S]*?---/, '')
      .replace(/[#*_`\[\]()]/g, ' ')
      .toLowerCase();

    const words = plainText.split(/\s+/).filter(w => w.length > 3);
    const phrases: string[] = [];

    for (let i = 0; i < words.length - 4; i++) {
      phrases.push(words.slice(i, i + 4).join(' '));
    }

    return phrases;
  }

  calculateOverallSimilarity(newContent: string): { maxSimilarity: number; mostSimilarTo: string } {
    let maxSimilarity = 0;
    let mostSimilarTo = '';

    const newPhrases = new Set(this.extractKeyPhrases(newContent));

    for (const [slug, existingPhrases] of this.existingContent) {
      const existingSet = new Set(existingPhrases);
      let overlap = 0;

      for (const phrase of newPhrases) {
        if (existingSet.has(phrase)) overlap++;
      }

      const similarity = overlap / Math.max(newPhrases.size, 1);

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
}

// -----------------------------------------------------------------------------
// OLLAMA CONTENT GENERATOR
// -----------------------------------------------------------------------------

export class OllamaContentGenerator {
  private client: OllamaClient;
  private uniquenessEngine: UniquenessEngine;
  private blogDir: string;

  constructor(blogDir: string, model?: string) {
    this.client = new OllamaClient({
      model: model || RECOMMENDED_MODELS.balanced,
      temperature: 0.7,
      maxTokens: 8000,
      timeout: 600000, // 10 minutes for long content
    });
    this.uniquenessEngine = new UniquenessEngine();
    this.blogDir = blogDir;
  }

  async initialize(): Promise<void> {
    // Check Ollama connection
    const connected = await this.client.checkConnection();
    if (!connected) {
      throw new Error('Cannot connect to Ollama. Make sure it is running on http://localhost:11434');
    }

    console.log(`Using Ollama model: ${this.client.getModel()}`);
    await this.uniquenessEngine.loadExistingContent(this.blogDir);
  }

  async generateBrief(
    topic: string,
    keyword: string,
    intent: 'informational' | 'transactional' | 'navigational' | 'commercial',
    audience: string
  ): Promise<ContentBrief> {
    const availableAngles = this.uniquenessEngine.getAvailableAngles(topic, intent);

    if (availableAngles.length === 0) {
      throw new Error(`All content angles exhausted for topic: ${topic}`);
    }

    const contentAngle = availableAngles[0];

    // Generate differentiators
    const diffPrompt = `You are a content strategist. For the topic "${topic}" with the angle "${contentAngle}", generate 5 unique differentiators that would make this article stand out. These should be specific and actionable.

Audience: ${audience}
Keyword: ${keyword}
Intent: ${intent}

Return ONLY a JSON array of 5 strings, no explanation:
["differentiator 1", "differentiator 2", "differentiator 3", "differentiator 4", "differentiator 5"]`;

    const diffResponse = await this.client.generate(diffPrompt);
    let differentiators: string[];
    try {
      differentiators = extractJSON(diffResponse);
    } catch {
      differentiators = [
        'Unique industry perspective',
        'Actionable implementation steps',
        'Real-world case study',
        'Common pitfalls to avoid',
        'Future trends analysis',
      ];
    }

    // Generate data points
    const dataPrompt = `For an article about "${topic}" targeting "${keyword}", provide 5 specific, verifiable data points or statistics. Each should be recent and cite-able.

Return ONLY valid JSON in this exact format:
[{"fact": "statistic here", "source": "source name", "verified": false}]`;

    const dataResponse = await this.client.generate(dataPrompt);
    let dataPoints: DataPoint[];
    try {
      dataPoints = extractJSON(dataResponse);
    } catch {
      dataPoints = [
        { fact: 'Industry statistics show significant growth', source: 'Industry Report 2024', verified: false },
        { fact: 'Survey data indicates high adoption rates', source: 'Market Research', verified: false },
        { fact: 'Case studies demonstrate measurable ROI', source: 'Case Study Analysis', verified: false },
      ];
    }

    // Generate unique insight
    const insightPrompt = `What is ONE unique insight about "${topic}" that most articles miss? Be specific and insightful in 2-3 sentences. Just give the insight, no other text.`;

    const uniqueInsight = await this.client.generate(insightPrompt);

    this.uniquenessEngine.registerAngle(topic, contentAngle);

    return {
      topic,
      targetKeyword: keyword,
      secondaryKeywords: [],
      searchIntent: intent,
      audience,
      contentAngle,
      differentiators: differentiators.slice(0, 5),
      dataPoints: dataPoints.slice(0, 5),
      uniqueInsight: uniqueInsight.trim().substring(0, 500),
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
- Structured for AI Overviews and featured snippets

CRITICAL RULES:
1. NEVER use generic filler content
2. EVERY paragraph must add unique value
3. Include specific examples, not vague statements
4. Use the data points provided
5. Write from the specific angle: ${brief.contentAngle}
6. First paragraph must directly answer the search intent
7. Minimum 2000 words of actual content`;

    const contentPrompt = `Write a comprehensive article for:

TOPIC: ${brief.topic}
TARGET KEYWORD: ${brief.targetKeyword}
SEARCH INTENT: ${brief.searchIntent}
CONTENT ANGLE: ${brief.contentAngle}
AUDIENCE: ${brief.audience}

DIFFERENTIATORS TO INCORPORATE:
${brief.differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}

DATA POINTS TO INCLUDE:
${brief.dataPoints.map((d, i) => `${i + 1}. ${d.fact} (Source: ${d.source})`).join('\n')}

UNIQUE INSIGHT TO WEAVE IN:
${brief.uniqueInsight}

REQUIREMENTS:
- Minimum 2000 words
- Use H2 (##) and H3 (###) headers for structure
- Include a FAQ section with 5 questions at the end
- First paragraph must answer the search query directly
- Include actionable takeaways
- End with a clear call to action

Return ONLY valid JSON with this structure (no markdown code blocks, just raw JSON):
{
  "title": "SEO-optimized title under 60 chars",
  "metaDescription": "Meta description under 155 chars",
  "slug": "url-friendly-slug",
  "content": "Full markdown content here",
  "faqItems": [{"question": "Q1", "answer": "A1"}]
}`;

    console.log('  Generating content with Ollama (this may take a few minutes)...');
    const response = await this.client.chat(
      [{ role: 'user', content: contentPrompt }],
      systemPrompt
    );

    let generatedData;
    try {
      generatedData = extractJSON(response);
    } catch (error) {
      console.error('Failed to parse content response, using fallback format');
      // Try to extract content even if JSON parsing failed
      generatedData = {
        title: `${brief.topic}: A Comprehensive Guide`,
        metaDescription: `Learn everything about ${brief.topic}. Expert insights for ${brief.audience}.`,
        slug: brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: response,
        faqItems: [],
      };
    }

    // Ensure content exists and meets minimum requirements
    if (!generatedData.content || generatedData.content.length < 500) {
      throw new Error('Generated content is too short. Please try again.');
    }

    const differentiationReport = this.evaluateDifferentiation(
      generatedData.content,
      brief
    );

    const contentHash = crypto
      .createHash('sha256')
      .update(generatedData.content)
      .digest('hex')
      .substring(0, 16);

    const wordCount = generatedData.content.split(/\s+/).length;

    return {
      ...generatedData,
      wordCount,
      uniquenessScore: differentiationReport.overallScore,
      qualityScore: this.evaluateQuality(generatedData.content, brief),
      contentHash,
      differentiationReport,
      generatedBy: this.client.getModel(),
    };
  }

  private evaluateDifferentiation(
    content: string,
    brief: ContentBrief
  ): DifferentiationReport {
    const { maxSimilarity, mostSimilarTo } =
      this.uniquenessEngine.calculateOverallSimilarity(content);

    let uniqueFactCount = 0;
    for (const dp of brief.dataPoints) {
      if (content.toLowerCase().includes(dp.fact.toLowerCase().substring(0, 30))) {
        uniqueFactCount++;
      }
    }

    const contentLower = content.toLowerCase();
    const sentences = contentLower.split(/[.!?]/).filter(s => s.length > 50);
    const uniquePhrases = sentences.slice(0, 5);

    const angleScore = 1 - maxSimilarity;
    const dataScore = uniqueFactCount / Math.max(brief.dataPoints.length, 1);
    const insightScore = contentLower.includes(
      brief.uniqueInsight.toLowerCase().substring(0, 30)
    ) ? 1 : 0.5;

    const overallScore = (angleScore * 0.4) + (dataScore * 0.35) + (insightScore * 0.25);

    const issues: string[] = [];
    if (maxSimilarity > CONFIG.maxSimilarity) {
      issues.push(`Too similar to: ${mostSimilarTo} (${(maxSimilarity * 100).toFixed(1)}%)`);
    }
    if (uniqueFactCount < CONFIG.requiredUniqueDataPoints) {
      issues.push(`Only ${uniqueFactCount}/${CONFIG.requiredUniqueDataPoints} data points included`);
    }

    return {
      uniqueFactCount,
      uniquePhrases,
      angleScore,
      dataScore,
      insightScore,
      overallScore,
      passesThreshold: overallScore >= CONFIG.minUniquenessScore && issues.length === 0,
      issues,
    };
  }

  private evaluateQuality(content: string, brief: ContentBrief): number {
    const wordCount = content.split(/\s+/).length;
    const h2Count = (content.match(/^## /gm) || []).length;
    const h3Count = (content.match(/^### /gm) || []).length;
    const listCount = (content.match(/^[*-] /gm) || []).length;

    let score = 0;

    // Word count scoring
    if (wordCount >= 2000) score += 0.3;
    else if (wordCount >= 1500) score += 0.2;
    else if (wordCount >= 1000) score += 0.1;

    // Structure scoring
    if (h2Count >= 3) score += 0.2;
    if (h3Count >= 2) score += 0.1;
    if (listCount >= 3) score += 0.1;

    // Content quality indicators
    if (content.includes(brief.targetKeyword)) score += 0.1;
    if (content.toLowerCase().includes('example')) score += 0.1;
    if (content.toLowerCase().includes('step')) score += 0.1;

    return Math.min(score, 1);
  }

  async regenerateIfNeeded(
    content: GeneratedContent,
    brief: ContentBrief,
    maxAttempts = 2
  ): Promise<GeneratedContent> {
    let current = content;
    let attempts = 0;

    while (!current.differentiationReport.passesThreshold && attempts < maxAttempts) {
      attempts++;
      console.log(`  Content below threshold, regenerating (attempt ${attempts}/${maxAttempts})...`);

      const modifiedBrief = { ...brief };
      modifiedBrief.contentAngle = `${brief.contentAngle}-variant-${attempts}`;

      current = await this.generateContent(modifiedBrief);
    }

    return current;
  }
}

// -----------------------------------------------------------------------------
// EXPORT
// -----------------------------------------------------------------------------

export const createOllamaContentGenerator = (blogDir: string, model?: string) => {
  return new OllamaContentGenerator(blogDir, model);
};
