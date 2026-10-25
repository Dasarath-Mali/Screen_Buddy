import { handleAnalyzeRequest } from '../../api/analyze';

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'method_not_allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '127.0.0.1';
    const userKey = event.headers['x-groq-key'];

    const response = await handleAnalyzeRequest(body, String(clientIp), userKey);
    return {
      statusCode: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response.body),
    };
  } catch (err: any) {
    console.error('Netlify Analyze handler error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'internal_error', message: err.message }),
    };
  }
};
