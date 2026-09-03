import type { Request, Response } from 'express';
import { getSecurityStatus, applyCorsHeaders } from '../../server/qzSecurity';

export default function handler(req: Request, res: Response) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const status = getSecurityStatus(req);
  return res.status(200).json(status);
}
