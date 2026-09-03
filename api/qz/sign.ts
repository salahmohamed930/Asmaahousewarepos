import type { Request, Response } from 'express';
import { signPayload, applyCorsHeaders } from '../../server/qzSecurity';

export default function handler(req: Request, res: Response) {
  const isAllowed = applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowed) {
    return res.status(403).json({
      error: 'Access denied: origin not allowed.',
    });
  }

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

  try {
    const { signature, isDevFallback } = signPayload(dataToSign);
    if (isDevFallback) {
      res.setHeader('X-QZ-Dev-Fallback', 'true');
    }
    return res.status(200).json({ signature, algorithm: 'SHA512' });
  } catch (err: any) {
    const isConfigError = err?.message?.includes('not configured');
    return res.status(isConfigError ? 503 : 500).json({
      error: isConfigError
        ? 'Signing service unavailable: QZ_PRIVATE_KEY is not configured.'
        : 'Failed to sign request securely.',
    });
  }
}
