import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { badRequest } from '../lib/http.js';

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Splits a `data:image/jpeg;base64,...` string into its parts and validates it.
 * Returns `null` when no image was supplied.
 */
export function parseDataUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Image must be a data URL string', { field: 'image' });
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(value.trim());
  if (!match) throw badRequest('Image must be a base64 data URL', { field: 'image' });

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED.has(mimeType)) {
    throw badRequest('Only JPEG, PNG or WebP photos are supported', { field: 'image' });
  }

  const base64 = match[2].replace(/\s/g, '');
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw badRequest('That photo is too large — keep it under 6 MB', { field: 'image' });
  }

  return { mimeType, base64, extension: ALLOWED.get(mimeType), bytes };
}

/** Writes a parsed image to the uploads folder and returns its public URL. */
export function saveImage(parsed) {
  if (!parsed) return null;
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${parsed.extension}`;
  const filePath = path.join(config.uploadsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(parsed.base64, 'base64'));
  return `/uploads/${fileName}`;
}
