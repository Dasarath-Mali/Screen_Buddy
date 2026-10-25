import { checkRateLimits, recordUsage } from '../server/services/ratelimit';
import { getCachedAnalysis, setCachedAnalysis } from '../server/services/cache';
import { executeAnalysisFallbackChain } from '../server/services/fallback';
import { verifyTurnstile } from '../server/services/turnstile';
import { estimateTotalTokens } from '../server/lib/tokens';
import { BoundingBox, evaluateRules } from '../server/services/rules';
import { runServerOCR } from '../server/services/ocr';
import crypto from 'crypto';

export interface AnalyzeRequestBody {
  image?: string; // base64 string
  lang?: string;
  app_hint?: string;
  elements?: BoundingBox[];
  ocr_text?: string;
  turnstile_token?: string;
}

export interface AnalyzeHandlerResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export async function handleAnalyzeRequest(
  body: AnalyzeRequestBody,
  clientIp = '127.0.0.1',
  userKeyHeader?: string
): Promise<AnalyzeHandlerResponse> {
  const lang = body.lang || 'en';
  let elements = Array.isArray(body.elements) ? [...body.elements] : [];
  let ocrText = body.ocr_text || '';
  const userGroqKey = userKeyHeader || '';

  // 1. Verify Turnstile if token provided or enabled
  if (body.turnstile_token) {
    const isHuman = await verifyTurnstile(body.turnstile_token, clientIp);
    if (!isHuman) {
      return {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'bot_detected', message: 'Verification failed. Please try again.' },
      };
    }
  }

  // 2. Validate image & input
  if (!body.image && !ocrText && elements.length === 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'bad_image', message: 'Please provide a screenshot or image to analyze.' },
    };
  }

  // 2b. Server-side OCR Fallback: If client OCR produced < 15 chars, extract directly on the server
  if (ocrText.trim().length < 15 && body.image) {
    try {
      const serverOcr = await runServerOCR(body.image);
      if (serverOcr.fullText && serverOcr.fullText.trim().length > 0) {
        ocrText = serverOcr.fullText;
        if (elements.length === 0 && serverOcr.elements.length > 0) {
          elements = serverOcr.elements;
        }
      }
    } catch (ocrErr) {
      console.warn('Server OCR fallback warning:', ocrErr);
    }
  }

  // Compute image hash for caching
  const hashSource = (body.image || '') + ocrText + lang;
  const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

  // 3. Rate limiting check (Bypass global bucket if BYO key is provided)
  const estimatedTokens = estimateTotalTokens(ocrText, 400, !!body.image);
  const limits = await checkRateLimits(clientIp, estimatedTokens);

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-RateLimit-Remaining': String(limits.remainingDay),
    'X-RateLimit-Reset': '86400',
  };

  if (!limits.allowed) {
    // If rate-limited, still produce a local rules-only fallback so the user is NEVER left vulnerable!
    const ruleFallback = evaluateRules(ocrText, elements, lang);

    if (limits.reason === 'per_user_minute' || limits.reason === 'per_user_day') {
      return {
        status: 429,
        headers: {
          ...baseHeaders,
          'Retry-After': String(limits.retryAfter || 20),
        },
        body: {
          error: 'slow_down',
          retry_after: limits.retryAfter || 20,
          fallback: ruleFallback,
        },
      };
    }

    // Global quota busy
    return {
      status: 503,
      headers: {
        ...baseHeaders,
        'Retry-After': String(limits.retryAfter || 60),
      },
      body: {
        error: 'busy',
        retry_after: limits.retryAfter || 60,
        fallback: ruleFallback,
      },
    };
  }

  // 4. Cache lookup by hash
  const cached = await getCachedAnalysis(imageHash);
  if (cached) {
    return {
      status: 200,
      headers: baseHeaders,
      body: cached,
    };
  }

  // 5, 6, 7, 8. Fallback chain execution
  const { result } = await executeAnalysisFallbackChain({
    apiKey: userGroqKey || process.env.GROQ_API_KEY,
    visionModel: process.env.GROQ_VISION_MODEL,
    textModel: process.env.GROQ_TEXT_MODEL,
    imageBase64: body.image,
    ocrText,
    elements,
    lang,
    isLiteMode: limits.isLiteMode,
  });

  // Record usage
  recordUsage(clientIp, estimatedTokens);

  // 10. Cache result by hash
  await setCachedAnalysis(imageHash, result);

  return {
    status: 200,
    headers: baseHeaders,
    body: result,
  };
}

// Default export for Vercel / serverless environments
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const userKey = req.headers['x-groq-key'] as string | undefined;

  try {
    const result = await handleAnalyzeRequest(req.body, String(clientIp), userKey);
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v);
    }
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error('Unhandled analyze error:', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Something went wrong. Please try again in a few moments.',
    });
  }
}
