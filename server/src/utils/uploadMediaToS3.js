import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const s3 = new S3Client({
  region: env.s3.region || 'eu-north-1',
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

export const mediaItems = [
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/gurpreet_singh_1788555386944.jpg',
    s3Key: 'farmers/gurpreet_singh.jpg',
    name: 'Gurpreet Singh',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/ram_lal_sharma_1788555400979.jpg',
    s3Key: 'farmers/ram_lal_sharma.jpg',
    name: 'Ram Lal Sharma',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/harjinder_kaur_1788555413406.jpg',
    s3Key: 'farmers/harjinder_kaur.jpg',
    name: 'Harjinder Kaur',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/crop_wheat_1788555426527.jpg',
    s3Key: 'crops/crop_wheat.jpg',
    name: 'Wheat Produce',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/crop_paddy_1788555441718.jpg',
    s3Key: 'crops/crop_paddy.jpg',
    name: 'Paddy Basmati Produce',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/crop_maize_1788555456626.jpg',
    s3Key: 'crops/crop_maize.jpg',
    name: 'Yellow Maize Produce',
  },
  {
    localPath: '/home/ubuntu/.gemini/antigravity-cli/brain/58c342a1-9ba6-4673-b668-61e8c1c1a530/crop_mustard_1788555473102.jpg',
    s3Key: 'crops/crop_mustard.jpg',
    name: 'Black Mustard Produce',
  },
];

export async function uploadAllMedia() {
  console.log(`[S3 Media] Uploading ${mediaItems.length} assets to s3://${env.s3.bucket}/ ...`);
  const uploadedUrls = {};

  for (const item of mediaItems) {
    try {
      const fileBuffer = await fs.readFile(item.localPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: item.s3Key,
          Body: fileBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000',
        })
      );
      const url = `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${item.s3Key}`;
      uploadedUrls[item.s3Key] = url;
      console.log(`✓ Uploaded ${item.name} -> ${url} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`✗ Failed to upload ${item.name}:`, err.message);
    }
  }

  return uploadedUrls;
}

if (process.argv[1] && process.argv[1].endsWith('uploadMediaToS3.js')) {
  uploadAllMedia()
    .then((urls) => {
      console.log('[S3 Media] All uploads completed successfully:\n', urls);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[S3 Media] Fatal upload error:', err);
      process.exit(1);
    });
}
