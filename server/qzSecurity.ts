import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';

export interface QzSecurityStatus {
  configured: boolean;
  hasCertificate: boolean;
  hasPrivateKey: boolean;
  algorithm: string;
  isDevelopment: boolean;
  isDevFallback: boolean;
  allowedOrigins: string[];
  isOriginAllowed?: boolean;
}

// Development-only fallback keypair generated lazily if running in non-production
// and no production keys are supplied. Never used in production!
let devKeyPair: { cert: string; privateKey: string } | null = null;

function getDevKeyPair(): { cert: string; privateKey: string } {
  if (!devKeyPair) {
    try {
      const devCertPath = path.resolve(process.cwd(), 'server/dev-certs/dev-certificate.pem');
      const devKeyPath = path.resolve(process.cwd(), 'server/dev-certs/dev-private-key.pem');
      if (fs.existsSync(devCertPath) && fs.existsSync(devKeyPath)) {
        devKeyPair = {
          cert: fs.readFileSync(devCertPath, 'utf8').trim(),
          privateKey: fs.readFileSync(devKeyPath, 'utf8').trim(),
        };
        return devKeyPair;
      }
    } catch {
      // Fall back to in-memory generation
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    devKeyPair = {
      cert: publicKey,
      privateKey,
    };
  }
  return devKeyPair;
}

/**
 * Normalizes PEM string formatting (handles escaped newlines \n from env vars)
 */
export function normalizePem(pem?: string): string {
  if (!pem) return '';
  let cleaned = pem.trim();
  // Handle literal \n strings that often occur in environment variable values
  if (cleaned.includes('\\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n');
  }
  return cleaned;
}

/**
 * Get configured allowed origins from environment variables and defaults
 */
export function getAllowedOrigins(): string[] {
  const list: string[] = [];

  // 1. Explicit QZ_ALLOWED_ORIGINS
  if (process.env.QZ_ALLOWED_ORIGINS) {
    process.env.QZ_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => {
        if (!list.includes(o)) list.push(o);
      });
  }

  // 2. APP_URL from environment
  if (process.env.APP_URL) {
    try {
      const parsed = new URL(process.env.APP_URL);
      if (!list.includes(parsed.origin)) {
        list.push(parsed.origin);
      }
    } catch {
      // ignore malformed URL
    }
  }

  // 3. In non-production or local development, allow localhost ports
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const localOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ];
    localOrigins.forEach((lo) => {
      if (!list.includes(lo)) list.push(lo);
    });
  }

  return list;
}

/**
 * Validates request Origin and Referer against allowed origins list
 */
export function isRequestOriginAllowed(req: Request): {
  allowed: boolean;
  origin: string;
} {
  const allowedOrigins = getAllowedOrigins();
  const rawOrigin = req.headers.origin as string | undefined;
  const rawReferer = req.headers.referer as string | undefined;

  let requestOrigin = '';

  if (rawOrigin) {
    requestOrigin = rawOrigin.trim().toLowerCase();
  } else if (rawReferer) {
    try {
      const parsed = new URL(rawReferer);
      requestOrigin = parsed.origin.toLowerCase();
    } catch {
      requestOrigin = '';
    }
  }

  // If running in development and no origin header was supplied (e.g. same-origin or local curl)
  const isDev = process.env.NODE_ENV !== 'production';
  if (!requestOrigin && isDev) {
    return { allowed: true, origin: 'http://localhost:3000' };
  }

  if (!requestOrigin) {
    return { allowed: false, origin: '' };
  }

  const isMatch = allowedOrigins.some((allowed) => {
    const norm = allowed.trim().toLowerCase();
    return norm === requestOrigin || norm === '*' || (norm.endsWith('/*') && requestOrigin.startsWith(norm.slice(0, -2)));
  });

  return { allowed: isMatch, origin: requestOrigin };
}

/**
 * Apply safe CORS headers for allowed origins
 */
export function applyCorsHeaders(req: Request, res: Response): boolean {
  const { allowed, origin } = isRequestOriginAllowed(req);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  return allowed;
}

/**
 * Retrieve Public Certificate (PEM)
 */
export function getPublicCertificate(): { cert: string; isDevFallback: boolean } {
  const envCert = normalizePem(process.env.QZ_CERTIFICATE);
  if (envCert) {
    return { cert: envCert, isDevFallback: false };
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const devKeys = getDevKeyPair();
    return { cert: devKeys.cert, isDevFallback: true };
  }

  throw new Error('QZ_CERTIFICATE environment variable is not configured');
}

/**
 * Retrieve Private Key (PEM) - Strictly server-side!
 */
export function getPrivateKey(): { privateKey: string; isDevFallback: boolean } {
  const envKey = normalizePem(process.env.QZ_PRIVATE_KEY);
  if (envKey) {
    return { privateKey: envKey, isDevFallback: false };
  }

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const devKeys = getDevKeyPair();
    return { privateKey: devKeys.privateKey, isDevFallback: true };
  }

  throw new Error('QZ_PRIVATE_KEY environment variable is not configured');
}

/**
 * Sign data string using RSA-SHA512
 * Never logs data, keys, or signatures to console!
 */
export function signPayload(dataToSign: string): {
  signature: string;
  algorithm: string;
  isDevFallback: boolean;
} {
  if (typeof dataToSign !== 'string' || dataToSign.length === 0) {
    throw new Error('Invalid payload to sign: must be a non-empty string');
  }

  // Enforce reasonable payload size limit (max 500KB)
  if (dataToSign.length > 500 * 1024) {
    throw new Error('Payload to sign exceeds maximum allowed size');
  }

  const { privateKey, isDevFallback } = getPrivateKey();

  try {
    const signer = crypto.createSign('SHA512');
    signer.update(dataToSign, 'utf8');
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    return { signature, algorithm: 'SHA512', isDevFallback };
  } catch (err: any) {
    // Return sanitized error without exposing key structure
    throw new Error('Cryptographic signature generation failed');
  }
}

/**
 * Verify an RSA-SHA512 signature using a public key or certificate
 */
export function verifySignature(data: string, signatureBase64: string, publicKeyOrCert: string): boolean {
  try {
    const verifier = crypto.createVerify('SHA512');
    verifier.update(data, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyOrCert, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Get comprehensive diagnostic status
 */
export function getSecurityStatus(req?: Request): QzSecurityStatus {
  const isDev = process.env.NODE_ENV !== 'production';
  const hasEnvCert = Boolean(process.env.QZ_CERTIFICATE?.trim());
  const hasEnvKey = Boolean(process.env.QZ_PRIVATE_KEY?.trim());
  const allowedOrigins = getAllowedOrigins();

  const isConfigured = hasEnvCert && hasEnvKey;
  const isDevFallback = !isConfigured && isDev;

  let isOriginAllowed: boolean | undefined = undefined;
  if (req) {
    isOriginAllowed = isRequestOriginAllowed(req).allowed;
  }

  return {
    configured: isConfigured || isDevFallback,
    hasCertificate: hasEnvCert || isDevFallback,
    hasPrivateKey: hasEnvKey || isDevFallback,
    algorithm: 'SHA512',
    isDevelopment: isDev,
    isDevFallback,
    allowedOrigins,
    isOriginAllowed,
  };
}
