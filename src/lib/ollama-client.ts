// =============================================================================
// ollama-client.ts - Local LLM Integration via Ollama
// =============================================================================
// Enables content generation using locally running Ollama models.
// Supports qwen2.5, nemotron, and other instruction-tuned models.
// =============================================================================

import { z } from 'zod';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:7b-instruct';

// Model recommendations by use case
export const RECOMMENDED_MODELS = {
  // Best for long-form content (if you have the VRAM)
  premium: 'nemotron-3-nano:30b-a3b-fp16',
  // Good balance of quality and speed
  balanced: 'qwen2.5:7b-instruct',
  // Fastest option
  fast: 'qwen2.5:7b-instruct',
};

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt?: string;
  messages?: OllamaMessage[];
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  response?: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

// -----------------------------------------------------------------------------
// OLLAMA CLIENT
// -----------------------------------------------------------------------------

export class OllamaClient {
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
      model: config.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL,
      temperature: config.temperature ?? 0.7,
      topP: config.topP ?? 0.9,
      maxTokens: config.maxTokens ?? 8000,
      timeout: config.timeout ?? 300000, // 5 minutes for long content
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async generate(
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            top_p: this.config.topP,
            num_predict: this.config.maxTokens,
          },
        } as OllamaGenerateRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      return data.response || '';
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama generation timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  async chat(
    messages: OllamaMessage[],
    systemPrompt?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const allMessages: OllamaMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: allMessages,
          stream: false,
          options: {
            temperature: this.config.temperature,
            top_p: this.config.topP,
            num_predict: this.config.maxTokens,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      return data.message?.content || '';
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama chat timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  getModel(): string {
    return this.config.model;
  }

  setModel(model: string): void {
    this.config.model = model;
  }
}

// -----------------------------------------------------------------------------
// JSON EXTRACTION HELPER
// -----------------------------------------------------------------------------

export function extractJSON(text: string): any {
  // Try to find JSON in the response
  const jsonPatterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /\{[\s\S]*\}/,
  ];

  for (const pattern of jsonPatterns) {
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

  // Try parsing the whole text as JSON
  try {
    return JSON.parse(text.trim());
  } catch {
    throw new Error('Could not extract valid JSON from response');
  }
}

// -----------------------------------------------------------------------------
// EXPORT
// -----------------------------------------------------------------------------

export const createOllamaClient = (config?: Partial<OllamaConfig>) => {
  return new OllamaClient(config);
};
