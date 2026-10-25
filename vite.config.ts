import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAnalyzeRequest } from './api/analyze';
import { handleTTSRequest } from './api/tts';

// Custom Vite plugin to handle /api/analyze and /api/tts in development
function apiDevPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // Handle TTS audio streaming
        if (req.url && req.url.startsWith('/api/tts') && req.method === 'GET') {
          try {
            const url = new URL(req.url, 'http://localhost:5173');
            const text = url.searchParams.get('text') || '';
            const lang = url.searchParams.get('lang') || 'en';

            const result = await handleTTSRequest(text, lang);
            res.statusCode = result.status;
            for (const [key, val] of Object.entries(result.headers)) {
              res.setHeader(key, val);
            }
            if (result.buffer) {
              res.end(result.buffer);
            } else {
              res.end(JSON.stringify({ error: result.error }));
            }
          } catch (err: any) {
            console.error('TTS handler error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // Handle Image & Screen analysis
        if (req.url === '/api/analyze' && req.method === 'POST') {
          try {
            let bodyBuffer = '';
            req.on('data', (chunk: Buffer) => {
              bodyBuffer += chunk.toString();
            });
            req.on('end', async () => {
              try {
                const body = JSON.parse(bodyBuffer || '{}');
                const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
                const userKey = req.headers['x-groq-key'] as string | undefined;

                const response = await handleAnalyzeRequest(body, String(clientIp), userKey);

                res.statusCode = response.status;
                for (const [key, val] of Object.entries(response.headers)) {
                  res.setHeader(key, val);
                }
                res.end(JSON.stringify(response.body));
              } catch (err: any) {
                console.error('Error handling API request:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
              }
            });
          } catch (err) {
            next(err);
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true as any,
  },
});
