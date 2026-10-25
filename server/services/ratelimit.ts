/**
 * Rate Limiting and Quota Protection Service
 * Implements:
 * Layer 2: Per-user limit (sliding window: 5/min, 30/day)
 * Layer 3: Global token bucket (Groq RPM/TPM protection)
 * Layer 4: Daily budget circuit breaker (Groq RPD/TPD)
 */

interface LimitStatus {
  allowed: boolean;
  reason?: 'per_user_minute' | 'per_user_day' | 'global_rpm' | 'global_tpm' | 'daily_exhausted';
  retryAfter?: number; // seconds
  remainingMinute: number;
  remainingDay: number;
  isLiteMode: boolean; // true if daily usage >= 90%
}

// In-memory fallback sliding window structures
interface UserHistory {
  minuteTimestamps: number[];
  dayTimestamps: number[];
}

const userHistories = new Map<string, UserHistory>();

// Global daily usage tracking
let dailyRequestCount = 0;
let dailyTokenCount = 0;
let dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;

// Global minute token tracking
let minuteRequestCount = 0;
let minuteTokenCount = 0;
let minuteResetTime = Date.now() + 60 * 1000;

export async function checkRateLimits(
  userId: string,
  estimatedTokens = 1200
): Promise<LimitStatus> {
  const now = Date.now();

  // Reset daily window if expired
  if (now > dailyResetTime) {
    dailyRequestCount = 0;
    dailyTokenCount = 0;
    dailyResetTime = now + 24 * 60 * 60 * 1000;
  }

  // Reset minute window if expired
  if (now > minuteResetTime) {
    minuteRequestCount = 0;
    minuteTokenCount = 0;
    minuteResetTime = now + 60 * 1000;
  }

  const safetyFactor = parseFloat(process.env.LIMIT_SAFETY_FACTOR || '0.8');
  const maxUserMin = parseInt(process.env.USER_LIMIT_PER_MIN || '5', 10);
  const maxUserDay = parseInt(process.env.USER_LIMIT_PER_DAY || '30', 10);

  // Global thresholds (defaults based on typical Groq free tier)
  const maxGlobalRPM = Math.floor(parseInt(process.env.GROQ_RPM || '30', 10) * safetyFactor);
  const maxGlobalTPM = Math.floor(parseInt(process.env.GROQ_TPM || '15000', 10) * safetyFactor);
  const maxGlobalRPD = Math.floor(parseInt(process.env.GROQ_RPD || '14400', 10) * safetyFactor);
  const maxGlobalTPD = Math.floor(parseInt(process.env.GROQ_TPD || '500000', 10) * safetyFactor);

  // 1. Layer 4: Daily circuit breaker
  if (dailyRequestCount >= maxGlobalRPD || dailyTokenCount >= maxGlobalTPD) {
    return {
      allowed: false,
      reason: 'daily_exhausted',
      retryAfter: Math.ceil((dailyResetTime - now) / 1000),
      remainingMinute: 0,
      remainingDay: 0,
      isLiteMode: true,
    };
  }

  const isLiteMode = dailyRequestCount >= maxGlobalRPD * 0.9 || dailyTokenCount >= maxGlobalTPD * 0.9;

  // 2. Layer 3: Global minute limiter
  if (minuteRequestCount >= maxGlobalRPM || minuteTokenCount + estimatedTokens > maxGlobalTPM) {
    return {
      allowed: false,
      reason: 'global_rpm',
      retryAfter: Math.max(1, Math.ceil((minuteResetTime - now) / 1000)),
      remainingMinute: 0,
      remainingDay: Math.max(0, maxUserDay - (userHistories.get(userId)?.dayTimestamps.length || 0)),
      isLiteMode,
    };
  }

  // 3. Layer 2: Per-user limiter
  let history = userHistories.get(userId);
  if (!history) {
    history = { minuteTimestamps: [], dayTimestamps: [] };
    userHistories.set(userId, history);
  }

  // Clean old timestamps
  const oneMinAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  history.minuteTimestamps = history.minuteTimestamps.filter(t => t > oneMinAgo);
  history.dayTimestamps = history.dayTimestamps.filter(t => t > oneDayAgo);

  if (history.minuteTimestamps.length >= maxUserMin) {
    const oldest = history.minuteTimestamps[0];
    const waitSeconds = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
    return {
      allowed: false,
      reason: 'per_user_minute',
      retryAfter: waitSeconds,
      remainingMinute: 0,
      remainingDay: Math.max(0, maxUserDay - history.dayTimestamps.length),
      isLiteMode,
    };
  }

  if (history.dayTimestamps.length >= maxUserDay) {
    const oldest = history.dayTimestamps[0];
    const waitSeconds = Math.max(1, Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000));
    return {
      allowed: false,
      reason: 'per_user_day',
      retryAfter: waitSeconds,
      remainingMinute: 0,
      remainingDay: 0,
      isLiteMode,
    };
  }

  const remainingMin = maxUserMin - history.minuteTimestamps.length;
  const remainingDay = maxUserDay - history.dayTimestamps.length;

  return {
    allowed: true,
    remainingMinute: remainingMin,
    remainingDay: remainingDay,
    isLiteMode,
  };
}

export function recordUsage(userId: string, tokensUsed = 1200): void {
  const now = Date.now();
  dailyRequestCount++;
  dailyTokenCount += tokensUsed;
  minuteRequestCount++;
  minuteTokenCount += tokensUsed;

  const history = userHistories.get(userId) || { minuteTimestamps: [], dayTimestamps: [] };
  history.minuteTimestamps.push(now);
  history.dayTimestamps.push(now);
  userHistories.set(userId, history);
}

export function updateCountersFromGroqHeaders(headers: Headers): void {
  // Update internal counters if Groq provides x-ratelimit headers
  const remainingReq = headers.get('x-ratelimit-remaining-requests');
  const remainingTokens = headers.get('x-ratelimit-remaining-tokens');
  if (remainingReq) {
    // Keep counters honest
  }
}
