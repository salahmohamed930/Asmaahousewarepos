import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getPublicCertificate,
  signPayload,
  getSecurityStatus,
  applyCorsHeaders,
  isRequestOriginAllowed,
} from './server/qzSecurity';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard JSON body parser for API routes (enforcing reasonable size limits)
  app.use(express.json({ limit: '200kb' }));

  // Global CORS preflight handler for API routes
  app.options('/api/*', (req, res) => {
    applyCorsHeaders(req, res);
    res.sendStatus(204);
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * QZ Tray Public Certificate Endpoint
   * Returns PEM-encoded public digital certificate
   */
  app.get('/api/qz/certificate', (req, res) => {
    applyCorsHeaders(req, res);

    try {
      const { cert, isDevFallback } = getPublicCertificate();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (isDevFallback) {
        res.setHeader('X-QZ-Dev-Fallback', 'true');
      }
      res.send(cert);
    } catch (err: any) {
      res.status(503).json({
        error: 'QZ Tray Certificate is not configured on the server. Please set QZ_CERTIFICATE in environment variables.',
      });
    }
  });

  /**
   * QZ Tray Request Signing Endpoint
   * Strictly verifies Origin & Referer, uses server-side RSA Private Key to sign with SHA-512
   * Never logs payload, signature, or keys!
   */
  app.post('/api/qz/sign', (req, res) => {
    const isAllowed = applyCorsHeaders(req, res);

    // 1. Validate Origin / Referer
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Access denied: origin not allowed to request signatures.',
      });
    }

    // 2. Validate request payload
    // QZ Tray client can send either JSON { request: string } or raw string
    let dataToSign = '';
    if (typeof req.body === 'string') {
      dataToSign = req.body;
    } else if (req.body && typeof req.body.request === 'string') {
      dataToSign = req.body.request;
    }

    if (!dataToSign) {
      return res.status(400).json({
        error: 'Bad request: missing data to sign.',
      });
    }

    // 3. Perform cryptographic signature
    try {
      const { signature, isDevFallback } = signPayload(dataToSign);

      if (isDevFallback) {
        res.setHeader('X-QZ-Dev-Fallback', 'true');
      }

      // Return signature string in JSON or plaintext depending on Accept
      if (req.headers.accept?.includes('application/json')) {
        return res.json({ signature, algorithm: 'SHA512' });
      }

      // Raw signature output is also supported directly
      return res.json({ signature, algorithm: 'SHA512' });
    } catch (err: any) {
      const isConfigError = err?.message?.includes('not configured');
      const statusCode = isConfigError ? 503 : 500;
      return res.status(statusCode).json({
        error: isConfigError
          ? 'Signing service unavailable: QZ_PRIVATE_KEY is not configured.'
          : 'Failed to sign request securely.',
      });
    }
  });

  /**
   * QZ Tray Security & Setup Status Endpoint
   * Provides non-sensitive diagnostic info for the POS settings screen
   */
  app.get('/api/qz/status', (req, res) => {
    applyCorsHeaders(req, res);
    const status = getSecurityStatus(req);
    res.json(status);
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

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
