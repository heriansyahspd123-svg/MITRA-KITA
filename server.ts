import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleArkasParse,
  handlePartnershipAnalysis,
} from './shared/aiBackend.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, runtime: 'node-express' });
  });

  app.post('/api/arkas/parse', async (req: Request, res: Response) => {
    const result = await handleArkasParse(req.body, process.env.GEMINI_API_KEY);
    res.status(result.status).json(result.body);
  });

  app.post(
    '/api/ai/partnership-analysis',
    async (req: Request, res: Response) => {
      const result = await handlePartnershipAnalysis(
        req.body,
        process.env.GEMINI_API_KEY
      );
      res.status(result.status).json(result.body);
    }
  );

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res
          .status(404)
          .send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MITRA KITA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
