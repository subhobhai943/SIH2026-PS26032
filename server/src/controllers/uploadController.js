import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';

const uploadSchema = z.object({
  image: z.string().min(50, 'Valid base64 image data URL required'),
  category: z.enum(['farmer_photo', 'crop_photo']).default('farmer_photo'),
  filename: z.string().optional(),
});

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

/**
 * Upload image handler.
 * If AWS S3 credentials exist in environment variables, uploads to S3.
 * Otherwise, stores safely in local server storage and returns public URL.
 */
export const uploadImage = asyncHandler(async (req, res) => {
  const { image, category, filename } = parse(uploadSchema, req.body);

  // Match base64 data URI format: data:image/(png|jpeg|webp);base64,....
  const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw ApiError.badRequest('Invalid image format. Must be a valid Base64 data URL (JPEG, PNG, or WebP).');
  }

  const mimeType = matches[1].toLowerCase();
  const ALLOWED_UPLOAD_MIMES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);

  const extension = ALLOWED_UPLOAD_MIMES.get(mimeType);
  if (!extension) {
    throw ApiError.badRequest('Forbidden image type. Only JPEG, PNG, and WebP images are permitted.');
  }

  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Max 5MB limit
  if (buffer.length > 5 * 1024 * 1024) {
    throw ApiError.badRequest('Image exceeds maximum allowed size of 5MB.');
  }

  // Deep binary magic byte verification to prevent polyglot / content-type confusion attacks
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throw ApiError.badRequest('Corrupted or invalid image binary signature. Upload rejected.');
  }

  const randomId = crypto.randomBytes(8).toString('hex');
  const safeFilename = `${category}_${Date.now()}_${randomId}.${extension}`;

  // 1. If AWS S3 is configured, upload to S3
  if (env.s3?.bucket && env.s3?.accessKeyId && env.s3?.secretAccessKey) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: env.s3.region || 'ap-south-1',
        credentials: {
          accessKeyId: env.s3.accessKeyId,
          secretAccessKey: env.s3.secretAccessKey,
        },
        ...(env.s3.endpoint ? { endpoint: env.s3.endpoint } : {}),
      });

      const s3Key = `uploads/${category}/${safeFilename}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      // Conceal cloud storage endpoints behind backend proxy to prevent S3 bucket exposure
      const proxiedUrl = `/api/media/${s3Key}`;

      return res.json({
        ok: true,
        data: {
          url: proxiedUrl,
          provider: 's3',
          filename: safeFilename,
          sizeBytes: buffer.length,
          mimeType,
        },
      });
    } catch (s3Err) {
      console.error('[Upload] AWS S3 upload failed, falling back to local storage:', s3Err.message);
    }
  }

  // 2. Local Storage Fallback
  const filePath = path.join(UPLOAD_DIR, safeFilename);
  await fs.writeFile(filePath, buffer);

  const localUrl = `/api/media/uploads/${safeFilename}`;

  return res.json({
    ok: true,
    data: {
      url: localUrl,
      provider: 'local',
      filename: safeFilename,
      sizeBytes: buffer.length,
      mimeType,
    },
  });
});
