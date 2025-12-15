/**
 * Optional Caching Middleware for Vercel AI SDK
 *
 * This middleware caches LLM responses to reduce API costs and improve response times
 * during development and testing. It can be disabled in production.
 *
 * Usage:
 * - Set ENABLE_LLM_CACHE=true in .env to enable caching
 * - Cache is stored in .cache/llm-cache.json (gitignored)
 * - Cached responses are keyed by a hash of the prompt and model parameters
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { LanguageModelV2Middleware } from '@ai-sdk/provider';
import {
  simulateReadableStream,
} from 'ai';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'llm-cache.json');
const CACHE_ENABLED = process.env.ENABLE_LLM_CACHE === 'true';

/**
 * Ensure cache directory and file exist
 */
function ensureCacheFile(): void {
  if (!CACHE_ENABLED) return;

  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, '{}');
    }
  } catch (error) {
    console.error('Failed to initialize cache:', error);
  }
}

/**
 * Generate cache key from parameters
 * This creates a deterministic hash of the request parameters
 */
function generateCacheKey(params: any, functionName: string): string {
  // Clean the prompt to remove any cache-control directives (Anthropic-specific)
  const cleanedParams = {
    ...params,
    prompt: Array.isArray(params.prompt)
      ? params.prompt.map((p: any) => {
          if (typeof p === 'object' && p.type === 'text') {
            return { type: p.type, text: p.text };
          }
          return p;
        })
      : params.prompt,
    _function: functionName,
  };

  const paramString = JSON.stringify(cleanedParams, Object.keys(cleanedParams).sort());
  return crypto.createHash('sha256').update(paramString).digest('hex');
}

/**
 * Get cached result by key
 */
function getCachedResult(key: string): any | null {
  if (!CACHE_ENABLED) return null;

  try {
    ensureCacheFile();
    const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheContent);
    const result = cache[key];

    if (result) {
      // Check if cache entry has expired (24 hours)
      const cacheAge = Date.now() - (result._cachedAt || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxAge) {
        console.log('🗑️  Cache entry expired, will regenerate');
        return null;
      }

      return result.data;
    }

    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Store result in cache
 */
function updateCache(key: string, value: any): void {
  if (!CACHE_ENABLED) return;

  try {
    ensureCacheFile();
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    cache[key] = {
      data: value,
      _cachedAt: Date.now(),
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('💾 Response cached for key:', key.substring(0, 12) + '...');
  } catch (error) {
    console.error('Failed to update cache:', error);
  }
}

/**
 * Clear all cached responses
 */
export function clearLLMCache(): void {
  if (!CACHE_ENABLED) {
    console.log('ℹ️  LLM cache is disabled');
    return;
  }

  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.writeFileSync(CACHE_FILE, '{}');
      console.log('🗑️  LLM cache cleared');
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getLLMCacheStats(): { enabled: boolean; entries: number; sizeKB: number } {
  if (!CACHE_ENABLED) {
    return { enabled: false, entries: 0, sizeKB: 0 };
  }

  try {
    ensureCacheFile();
    const stats = fs.statSync(CACHE_FILE);
    const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheContent);

    return {
      enabled: true,
      entries: Object.keys(cache).length,
      sizeKB: Math.round(stats.size / 1024),
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { enabled: true, entries: 0, sizeKB: 0 };
  }
}

/**
 * Caching middleware for Vercel AI SDK
 *
 * This middleware caches both streaming and non-streaming responses.
 * Streaming responses are reconstructed from cached chunks.
 */
export const cacheMiddleware: LanguageModelV2Middleware = {
  /**
   * Cache non-streaming generateText calls
   */
  wrapGenerate: async (options) => {
    const { doGenerate, params } = options;
    if (!CACHE_ENABLED) {
      return doGenerate();
    }

    const cacheKey = generateCacheKey(params, 'generate');
    console.log('🔍 Cache key:', cacheKey.substring(0, 12) + '...');

    const cached = getCachedResult(cacheKey);

    if (cached !== null) {
      console.log('✅ Cache HIT - returning cached response');
      return {
        ...cached,
        response: {
          ...cached.response,
          timestamp: cached?.response?.timestamp
            ? new Date(cached?.response?.timestamp)
            : undefined,
        },
      };
    }

    console.log('❌ Cache MISS - calling LLM');
    const result = await doGenerate();

    updateCache(cacheKey, result);

    return result;
  },

  /**
   * Cache streaming streamText calls
   */
  wrapStream: async (options) => {
    const { doStream, params } = options;
    if (!CACHE_ENABLED) {
      return doStream();
    }

    const cacheKey = generateCacheKey(params, 'stream');
    console.log('🔍 Cache key:', cacheKey.substring(0, 12) + '...');

    const cached = getCachedResult(cacheKey);

    // If cached, return a simulated ReadableStream
    if (cached !== null) {
      console.log('✅ Cache HIT - simulating stream from cache');
      const formattedChunks = (cached as any[]).map((p: any) => {
        if (p.type === 'response-metadata' && p.timestamp) {
          return { ...p, timestamp: new Date(p.timestamp) };
        }
        return p;
      });

      return {
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 10,
          chunks: formattedChunks,
        }),
      };
    }

    console.log('❌ Cache MISS - streaming from LLM');

    // If not cached, proceed with streaming and capture the response
    const { stream, ...rest } = await doStream();

    const fullResponse: any[] = [];

    const transformStream = new TransformStream<any, any>({
      transform(chunk, controller) {
        fullResponse.push(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        // Store the full response in the cache after streaming is complete
        updateCache(cacheKey, fullResponse);
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
