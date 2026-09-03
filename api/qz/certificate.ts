import type { Request, Response } from 'express';
import { getPublicCertificate, applyCorsHeaders } from '../../server/qzSecurity';

export default function handler(req: Request, res: Response) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cert, isDevFallback } = getPublicCertificate();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (isDevFallback) {
      res.setHeader('X-QZ-Dev-Fallback', 'true');
    }
    return res.status(200).send(cert);
  } catch (err: any) {
    return res.status(503).json({
      error: 'QZ Tray Certificate is not configured on the server. Please set QZ_CERTIFICATE.',
    });
  }
}
