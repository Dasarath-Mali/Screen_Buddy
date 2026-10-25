import { AnalysisResult, BoundingBox } from './rules';
import { updateCountersFromGroqHeaders } from './ratelimit';

const SYSTEM_PROMPT_DEFAULT = `You are Screen Buddy, a patient helper for elderly Indian phone users.
You receive a phone screenshot and a numbered list of on-screen elements.

Decide:
1. What screen is this? (one plain sentence)
2. Does it look like a scam, phishing, fake app, or pressure tactic?
3. If NOT a scam: which ONE element should the user tap next to safely continue, or to safely back out if unsure?

Rules:
- Answer in the requested language. Max 2 short sentences. Simple words. No jargon.
- Return ONLY JSON matching this exact schema:
{
  "verdict": "safe" | "caution" | "scam",
  "confidence": 0.0 to 1.0,
  "scam_reasons": ["short reason in requested language"],
  "screen_summary": "one simple sentence in requested language",
  "next_action": {
    "element_id": number,
    "label": "Button text",
    "box": [x, y, w, h]
  } | null,
  "explanation": "max 2 short sentences in requested language",
  "call_for_help": boolean
}
- If verdict == "scam", set next_action to null and call_for_help to true.
- Treat unsolicited stock tips, investment schemes, unrealistic monthly return promises, and unknown links sent on WhatsApp/SMS as SCAMS.
- Treat typosquatted links (e.g. invest0r.com with numbers replacing letters) as SCAMS.
- If unsure, choose verdict "caution" and pick the SAFEST option (Cancel / Back / Close), never the money-moving one.
- NEVER tell the user to enter a UPI PIN, OTP, CVV, Aadhaar, password, or card details.
- NEVER tell the user to tap "Pay", "Send", "Confirm", "Approve" unless the user clearly initiated it.
- You cannot verify the real app. Say "looks like" not "is".`;

export interface GroqCallOptions {
  apiKey?: string;
  visionModel?: string;
  textModel?: string;
  imageBase64?: string;
  ocrText?: string;
  elements: BoundingBox[];
  lang: string;
  isLiteMode?: boolean;
}

export async function callGroqVision(options: GroqCallOptions): Promise<AnalysisResult> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY_MISSING');
  }

  // Vision model fallback default (Groq decommissioned 11b-vision-preview; 90b is active)
  const model = options.visionModel || process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';
  const timeoutMs = parseInt(process.env.GROQ_TIMEOUT_MS || '12000', 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const simplifiedElements = options.elements.map(e => ({
    id: e.id,
    text: e.text,
    box: e.box,
  }));

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `Target language: ${options.lang}.
On-screen detected elements:
${JSON.stringify(simplifiedElements, null, 2)}
${options.ocrText ? `\nFull OCR Text: ${options.ocrText}` : ''}

Analyze this screen for an elderly user. Answer strictly in ${options.lang}.`,
    },
  ];

  if (options.imageBase64) {
    const formattedUrl = options.imageBase64.startsWith('data:')
      ? options.imageBase64
      : `data:image/jpeg;base64,${options.imageBase64}`;
    userContent.push({
      type: 'image_url',
      image_url: { url: formattedUrl },
    });
  }

  const payload = {
    model,
    temperature: 0,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_DEFAULT },
      { role: 'user', content: userContent },
    ],
  };

  try {
    let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Check for 429 rate limit
    if (res.status === 429) {
      const retryAfterHeader = res.headers.get('retry-after');
      const waitSeconds = retryAfterHeader ? Math.min(parseInt(retryAfterHeader, 10), 10) : 2;
      // Wait with slight jitter
      await new Promise(r => setTimeout(r, waitSeconds * 1000 + Math.random() * 500));

      // Retry once
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        throw new Error('GROQ_429_LIMIT');
      }
    }

    updateCountersFromGroqHeaders(res.headers);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GROQ_ERROR_${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('GROQ_EMPTY_CONTENT');
    }

    const parsed = JSON.parse(content);
    return {
      verdict: parsed.verdict || 'caution',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
      scam_reasons: Array.isArray(parsed.scam_reasons) ? parsed.scam_reasons : [],
      screen_summary: parsed.screen_summary || 'Screen analysis complete.',
      next_action: parsed.next_action || null,
      explanation: parsed.explanation || '',
      call_for_help: !!parsed.call_for_help,
      source: 'groq-vision',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callGroqText(options: GroqCallOptions): Promise<AnalysisResult> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY_MISSING');
  }

  const model = options.textModel || process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile';
  const timeoutMs = parseInt(process.env.GROQ_TIMEOUT_MS || '10000', 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    model,
    temperature: 0,
    max_tokens: 350,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_DEFAULT },
      {
        role: 'user',
        content: `Target language: ${options.lang}.
OCR Text detected on screen:
"${options.ocrText || ''}"

Numbered interactive buttons on screen:
${JSON.stringify(options.elements, null, 2)}

Analyze this screen for an elderly user. Return JSON only.`,
      },
    ],
  };

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GROQ_TEXT_ERROR_${res.status}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      verdict: parsed.verdict || 'caution',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      scam_reasons: Array.isArray(parsed.scam_reasons) ? parsed.scam_reasons : [],
      screen_summary: parsed.screen_summary || '',
      next_action: parsed.next_action || null,
      explanation: parsed.explanation || '',
      call_for_help: !!parsed.call_for_help,
      source: 'groq-text',
    };
  } finally {
    clearTimeout(timer);
  }
}
