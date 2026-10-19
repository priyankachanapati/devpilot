import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

export const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Primary fast model with healthy quota, with automatic fallback list
export const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
export const EMBEDDING_MODEL_NAME = 'gemini-embedding-2-preview';
export const VECTOR_DIMENSIONS = 768; // Consistent dimensions across Gemini and fallback embeddings

export interface EmbeddingResult {
  values: number[];
  isFallback: boolean;
  error?: string;
}

/**
 * Generate vector embeddings with explicit 768 outputDimensionality and bounded retry
 */
export async function getEmbeddingWithDetails(
  text: string,
  retryCount = 2
): Promise<EmbeddingResult> {
  if (!apiKey) {
    return {
      values: generateFallbackEmbedding(text, VECTOR_DIMENSIONS),
      isFallback: true,
      error: 'GEMINI_API_KEY is not configured on server',
    };
  }

  const safeText = text.slice(0, 3500);

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      // Configurable timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL_NAME,
        contents: safeText,
        config: {
          outputDimensionality: VECTOR_DIMENSIONS,
        },
      });

      clearTimeout(timeoutId);

      const values = result.embeddings?.[0]?.values;
      if (values && values.length > 0) {
        return {
          values,
          isFallback: false,
        };
      }
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota');
      const isTransient = isRateLimit || err?.status === 503 || err?.name === 'AbortError';

      if (attempt < retryCount && isTransient) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`[Gemini Embedding] Transient error (attempt ${attempt + 1}/${retryCount + 1}), retrying in ${Math.round(delay)}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.warn(`[Gemini Embedding] Failed to generate embedding: ${err?.message || err}. Using semantic token fallback.`);
      return {
        values: generateFallbackEmbedding(text, VECTOR_DIMENSIONS),
        isFallback: true,
        error: err?.message || 'Embedding request failed',
      };
    }
  }

  return {
    values: generateFallbackEmbedding(text, VECTOR_DIMENSIONS),
    isFallback: true,
    error: 'Embedding retries exhausted',
  };
}

/**
 * Convenience method returning just the vector values (compatible with existing callers)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const res = await getEmbeddingWithDetails(text);
  return res.values;
}

/**
 * Generate deterministic semantic-lexical embedding vector (768 dimensions)
 * Unit-normalized so cosine similarity mathematically aligns.
 */
export function generateFallbackEmbedding(text: string, dimensions = VECTOR_DIMENSIONS): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase();
  const words = normalized.split(/[^a-zA-Z0-9_$]+/g).filter(w => w.length > 1);

  if (words.length === 0) return vector;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash * 31 + word.charCodeAt(c)) >>> 0;
    }

    const index1 = hash % dimensions;
    const index2 = (hash * 17 + 13) % dimensions;
    const index3 = (hash * 37 + 7) % dimensions;

    const weight = Math.log(1 + 1 / (i + 1)) * 1.5;
    vector[index1] += 1.0 * weight;
    vector[index2] += 0.6 * weight;
    vector[index3] += 0.3 * weight;
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Calculate cosine similarity between two vectors.
 * Supports Matryoshka Representation Learning (MRL) dimension alignment (e.g. 768 query vs 3072 chunk).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Robust JSON extraction helper
 */
function extractJsonBlock(raw: string): string {
  // If wrapped in markdown codeblock
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Find first { ... } or [ ... ]
  const firstBrace = raw.indexOf('{');
  const firstBracket = raw.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = raw.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = raw.lastIndexOf(']');
  }

  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1).trim();
  }

  return raw.trim();
}

/**
 * Robust structured JSON generation with model fallback, timeout, and bounded retries
 */
export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction: string,
  fallback: T,
  options: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<{ data: T; isFallback: boolean; error?: string; modelUsed: string; retries: number }> {
  const { timeoutMs = 28000, maxRetries = 2 } = options;

  if (!apiKey) {
    return {
      data: fallback,
      isFallback: true,
      error: 'GEMINI_API_KEY not configured',
      modelUsed: 'local_fallback',
      retries: 0,
    };
  }

  const candidateModels = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: any = null;
  let totalRetries = 0;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) totalRetries++;

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model request timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const callPromise = ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);
        const raw = response.text || '';
        const cleaned = extractJsonBlock(raw);

        if (!cleaned) {
          throw new Error('Empty response received from model');
        }

        const parsed = JSON.parse(cleaned) as T;
        return {
          data: parsed,
          isFallback: false,
          modelUsed: model,
          retries: totalRetries,
        };
      } catch (err: any) {
        lastError = err;
        const isQuota = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota');
        const isTransient = isQuota || err?.status === 503 || err?.message?.includes('timed out');

        if (isQuota) {
          // If quota exceeded on this model, immediately try next candidate model!
          console.warn(`[Gemini Model ${model}] Quota exceeded (429). Switching to alternative model...`);
          break; // break retry loop, move to next candidate model
        }

        if (attempt < maxRetries && isTransient) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[Gemini Model ${model}] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Other errors: try next model
        break;
      }
    }
  }

  console.error('[Gemini Structured Generation Exhausted]', lastError?.message || lastError);
  return {
    data: fallback,
    isFallback: true,
    error: lastError?.message || 'Model structured generation failed across all candidate models',
    modelUsed: 'fallback',
    retries: totalRetries,
  };
}
