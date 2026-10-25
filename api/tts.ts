/**
 * Serverless / API endpoint to stream high-quality TTS audio
 * for Indian regional languages (Telugu, Marathi, Bengali, Tamil, Hindi, etc.)
 */

export async function handleTTSRequest(text: string, lang = 'en'): Promise<{ status: number; headers: Record<string, string>; buffer?: Buffer; error?: string }> {
  if (!text || !text.trim()) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      error: 'Missing text parameter',
    };
  }

  // Language mapping
  const langMap: Record<string, string> = {
    te: 'te',
    mr: 'mr',
    bn: 'bn',
    ta: 'ta',
    hi: 'hi',
    en: 'en',
  };

  const targetLang = langMap[lang] || 'en';
  // Trim text to avoid exceeding single query limits
  const cleanText = text.trim().slice(0, 200);

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${targetLang}&client=tw-ob`;

  try {
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`TTS provider returned ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(buffer.byteLength),
      },
      buffer,
    };
  } catch (err: any) {
    console.error('Error fetching TTS audio:', err);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      error: err.message,
    };
  }
}

// Serverless handler for Vercel / Netlify
export default async function handler(req: any, res: any) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const text = url.searchParams.get('text') || (req.query?.text as string) || '';
  const lang = url.searchParams.get('lang') || (req.query?.lang as string) || 'en';

  const result = await handleTTSRequest(text, lang);
  for (const [k, v] of Object.entries(result.headers)) {
    res.setHeader(k, v);
  }

  if (result.buffer) {
    return res.status(result.status).send(result.buffer);
  }
  return res.status(result.status).json({ error: result.error });
}
