/**
 * Netlify Serverless Function for Regional TTS Audio Streaming
 * Supports Telugu, Marathi, Bengali, Tamil, Hindi, English
 */

export const handler = async (event: any) => {
  const text = event.queryStringParameters?.text || '';
  const lang = event.queryStringParameters?.lang || 'en';

  if (!text || !text.trim()) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing text parameter' }),
    };
  }

  const langMap: Record<string, string> = {
    te: 'te',
    mr: 'mr',
    bn: 'bn',
    ta: 'ta',
    hi: 'hi',
    en: 'en',
  };

  const targetLang = langMap[lang] || 'en';
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
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: base64Audio,
      isBase64Encoded: true,
    };
  } catch (err: any) {
    console.error('Netlify TTS error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
