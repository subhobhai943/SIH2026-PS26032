import path from 'node:path';
import fs from 'node:fs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const MEDIA_DIR = path.resolve(process.cwd(), 'media');
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Singleton S3 client if configured
let s3Client = null;
if (env.s3?.bucket && env.s3?.accessKeyId && env.s3?.secretAccessKey) {
  s3Client = new S3Client({
    region: env.s3.region || 'eu-north-1',
    credentials: {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
    },
    ...(env.s3.endpoint ? { endpoint: env.s3.endpoint } : {}),
  });
}

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.ico',
  '.avif',
]);

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
};

/**
 * Sanitize and validate asset key to prevent path traversal
 */
function sanitizeKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;

  // Remove leading slashes and decode
  let cleanKey = decodeURIComponent(rawKey).replace(/^[/\\]+/, '');

  // Prevent path traversal
  const normalized = path.normalize(cleanKey).replace(/^(\.\.[/\\])+/, '');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes('\0')) {
    return null;
  }

  // Check file extension
  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }

  return normalized;
}

/**
 * Media Proxy Controller
 * Securely streams media from private AWS S3 bucket, hiding bucket name,
 * region, and cloud credentials from frontend clients.
 * Falls back to local media directory if S3 is unavailable.
 */
export async function getMedia(req, res, next) {
  try {
    // Extract key from route wildcard
    const rawKey = req.params[0] || (req.params.category && req.params.filename ? `${req.params.category}/${req.params.filename}` : '');
    const s3Key = sanitizeKey(rawKey);

    if (!s3Key) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Invalid or forbidden media resource path.' },
      });
    }

    const ext = path.extname(s3Key).toLowerCase();
    const fallbackMime = MIME_MAP[ext] || 'application/octet-stream';

    // 1. Try serving from AWS S3 if configured
    if (s3Client && env.s3?.bucket) {
      try {
        const s3Res = await s3Client.send(
          new GetObjectCommand({
            Bucket: env.s3.bucket,
            Key: s3Key,
          })
        );

        // Check conditional ETag for 304 Not Modified
        const clientEtag = req.headers['if-none-match'];
        if (s3Res.ETag && clientEtag && clientEtag === s3Res.ETag) {
          return res.status(304).end();
        }

        res.set({
          'Content-Type': s3Res.ContentType || fallbackMime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...(s3Res.ContentLength ? { 'Content-Length': s3Res.ContentLength } : {}),
          ...(s3Res.ETag ? { ETag: s3Res.ETag } : {}),
          ...(s3Res.LastModified ? { 'Last-Modified': s3Res.LastModified.toUTCString() } : {}),
        });

        return s3Res.Body.pipe(res);
      } catch (s3Err) {
        // If not found on S3 or S3 error, proceed to check local fallbacks
        if (s3Err.name !== 'NoSuchKey') {
          console.warn(`[Media Proxy] S3 fetch warning for "${s3Key}":`, s3Err.message);
        }
      }
    }

    // 2. Local Fallback Check
    // Check in server/media/<key>
    const localMediaPath = path.join(MEDIA_DIR, s3Key);
    if (fs.existsSync(localMediaPath)) {
      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': fallbackMime,
      });
      return res.sendFile(localMediaPath);
    }

    // Check in server/uploads/<key>
    const localUploadPath = path.join(UPLOAD_DIR, s3Key);
    if (fs.existsSync(localUploadPath)) {
      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': fallbackMime,
      });
      return res.sendFile(localUploadPath);
    }

    // Check in server/uploads/<basename>
    const basename = path.basename(s3Key);
    const directUploadPath = path.join(UPLOAD_DIR, basename);
    if (fs.existsSync(directUploadPath)) {
      res.set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': fallbackMime,
      });
      return res.sendFile(directUploadPath);
    }

    // 3. Not found anywhere
    return res.status(404).json({
      ok: false,
      error: { message: `Media asset "${s3Key}" not found.` },
    });
  } catch (err) {
    return next(err);
  }
}
