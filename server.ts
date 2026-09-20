import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard JSON body parser for API routes (enforcing reasonable size limits)
  app.use(express.json({ limit: '200kb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`POS Server running on http://0.0.0.0:${PORT}`);
  });
}

process.on('unhandledRejection', (reason: any) => {
  console.warn('[SERVER] Caught unhandled promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('[SERVER] Caught uncaught exception:', err?.message || err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

