import { AnalysisResult } from './rules';

// In-memory cache fallback with 10-minute TTL
interface CacheEntry {
  result: AnalysisResult;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getCachedAnalysis(hash: string): Promise<AnalysisResult | null> {
  // Check Upstash Redis if credentials available
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/sb:cache:${hash}`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          const parsed = JSON.parse(data.result);
          return { ...parsed, source: 'cached' };
        }
      }
    } catch {
      // Fall through to in-memory cache
    }
  }

  // Check in-memory cache
  const entry = memoryCache.get(hash);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      return { ...entry.result, source: 'cached' };
    }
    memoryCache.delete(hash);
  }
  return null;
}

export async function setCachedAnalysis(hash: string, result: AnalysisResult): Promise<void> {
  // Save to Upstash Redis if available
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/set/sb:cache:${hash}?ex=${10 * 60}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          body: JSON.stringify(result),
        }
      );
    } catch {
      // Fall through
    }
  }

  // Clean old memory cache items periodically
  if (memoryCache.size > 200) {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (value.expiresAt <= now) {
        memoryCache.delete(key);
      }
    }
  }

  memoryCache.set(hash, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
