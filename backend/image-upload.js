import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root uploads directory
const rootUploadsDir = path.resolve(__dirname, 'uploads');

/**
 * Format bytes into human readable format
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Robustly parses Base64 Data URI or raw base64 string
 * Supports all valid image MIME types, handles RFC 2045 newlines, charsets, and query parameters.
 */
export function parseBase64Image(dataUriOrBase64, fallbackFilename = 'image.jpg') {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
    return { success: false, error: 'No image data provided.' };
  }

  const str = dataUriOrBase64.trim();
  let mimeType = 'image/jpeg';
  let rawBase64 = str;

  const headerMatch = str.match(/^data:([a-zA-Z0-9.+_\/-]+?)(?:;[a-zA-Z0-9=._-]+)*;base64,([\s\S]+)$/i);
  if (headerMatch) {
    mimeType = headerMatch[1].toLowerCase();
    rawBase64 = headerMatch[2];
  } else {
    const ext = fallbackFilename.split('.').pop().toLowerCase();
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'svg') mimeType = 'image/svg+xml';
    else mimeType = 'image/jpeg';
  }

  // Strip all whitespace and newlines from base64 data
  const cleanBase64 = rawBase64.replace(/\s+/g, '');
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch (e) {
    return { success: false, error: 'Failed to decode base64 image data.' };
  }

  if (!buffer || buffer.length === 0) {
    return { success: false, error: 'Image file appears to be empty or corrupted.' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (buffer.length > maxSize) {
    return { success: false, error: 'Image file size exceeds maximum limit of 10MB.' };
  }

  let ext = 'jpg';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  else if (mimeType.includes('svg')) ext = 'svg';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else {
    return { success: false, error: 'Only JPEG, PNG, WebP, GIF, and SVG images are allowed.' };
  }

  return {
    success: true,
    buffer,
    mimeType,
    ext,
    size: buffer.length
  };
}

/**
 * Safely delete an existing uploaded file from disk when replacing an image
 * Protects default assets like /default-cover.jpg, /profile.png
 */
export function deleteLocalUploadFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return false;
  const cleanUrl = fileUrl.trim().split('?')[0];
  if (!cleanUrl.startsWith('/uploads/')) return false;

  // Protect system defaults
  const protectedPatterns = ['/default-', '/profile.png', 'placeholder', 'avatar-default'];
  if (protectedPatterns.some(p => cleanUrl.toLowerCase().includes(p))) {
    return false;
  }

  const safeRelPath = path.normalize(cleanUrl.replace(/^\/uploads\//, '')).replace(/^(\.\.[\/\\])+/, '');
  
  // Search in both backend/uploads and server/uploads for robust synchronization
  const candidateDirs = [
    rootUploadsDir,
    path.resolve(__dirname, '../server/uploads'),
    path.resolve(__dirname, '../backend/uploads')
  ];

  let deleted = false;
  const seenPaths = new Set();

  for (const baseDir of candidateDirs) {
    try {
      if (!fs.existsSync(baseDir)) continue;
      const fullPath = path.resolve(baseDir, safeRelPath);
      if (seenPaths.has(fullPath)) continue;
      seenPaths.add(fullPath);

      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        deleted = true;
      }
    } catch (err) {
      console.warn(`[deleteLocalUploadFile] Failed to unlink ${cleanUrl}:`, err.message);
    }
  }

  return deleted;
}

/**
 * Save Base64 image persistently to disk under /uploads/<folder>/
 * If oldImageUrl is provided, automatically deletes the previous file.
 * Returns relative path '/uploads/<folder>/<filename>'
 */
export function saveBase64Image(dataUrl, folder = 'covers', prefix = 'image', oldImageUrl = null) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return dataUrl;
  }

  const trimmed = dataUrl.trim();
  // If it's already an existing URL and not a base64 payload, keep as-is
  if (!trimmed.startsWith('data:image/') && !trimmed.startsWith('data:;base64,')) {
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (oldImageUrl && oldImageUrl !== trimmed) {
        deleteLocalUploadFile(oldImageUrl);
      }
      return trimmed;
    }
    // If not starting with data: but looks like raw base64 (> 100 chars and matches base64 chars)
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const parsed = parseBase64Image(trimmed, `${prefix}.jpg`);
  if (!parsed.success) {
    console.error(`[saveBase64Image] Parse error in folder "${folder}":`, parsed.error);
    return dataUrl;
  }

  try {
    const uploadDir = path.resolve(__dirname, 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const rand = crypto.randomBytes(4).toString('hex');
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
    const filename = `${safePrefix}-${Date.now()}-${rand}.${parsed.ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, parsed.buffer);

    // Also mirror to sibling uploads directory if it exists
    const siblingDirs = [
      path.resolve(__dirname, '../server/uploads', folder),
      path.resolve(__dirname, '../backend/uploads', folder)
    ];
    for (const sib of siblingDirs) {
      try {
        if (sib !== uploadDir && fs.existsSync(path.dirname(sib))) {
          if (!fs.existsSync(sib)) fs.mkdirSync(sib, { recursive: true });
          fs.writeFileSync(path.join(sib, filename), parsed.buffer);
        }
      } catch {}
    }

    const relativeUrl = `/uploads/${folder}/${filename}`;

    // Clean up old image if replacing
    if (oldImageUrl && oldImageUrl !== relativeUrl) {
      deleteLocalUploadFile(oldImageUrl);
    }

    return relativeUrl;
  } catch (err) {
    console.error(`[saveBase64Image] Failed to write image to disk in ${folder}:`, err.message);
    return dataUrl;
  }
}

/**
 * High-level helper for handling image uploads with full validation & metadata recording
 */
export async function saveUploadedImageFile({
  base64Data,
  folder = 'covers',
  prefix = 'image',
  filename = 'image.jpg',
  oldImageUrl = null,
  userId = null
}) {
  const allowedFolders = ['covers', 'avatars', 'media', 'comments', 'chat', 'stories'];
  const targetFolder = allowedFolders.includes(folder) ? folder : 'covers';

  const parsed = parseBase64Image(base64Data, filename);
  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  try {
    const uploadDir = path.resolve(__dirname, 'uploads', targetFolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const cleanOriginal = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const rand = crypto.randomBytes(4).toString('hex');
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
    const safeFilename = `${safePrefix}-${Date.now()}-${rand}.${parsed.ext}`;
    const filePath = path.join(uploadDir, safeFilename);

    fs.writeFileSync(filePath, parsed.buffer);

    // Mirror to sibling uploads dir
    const siblingDirs = [
      path.resolve(__dirname, '../server/uploads', targetFolder),
      path.resolve(__dirname, '../backend/uploads', targetFolder)
    ];
    for (const sib of siblingDirs) {
      try {
        if (sib !== uploadDir && fs.existsSync(path.dirname(sib))) {
          if (!fs.existsSync(sib)) fs.mkdirSync(sib, { recursive: true });
          fs.writeFileSync(path.join(sib, safeFilename), parsed.buffer);
        }
      } catch {}
    }

    const relativeUrl = `/uploads/${targetFolder}/${safeFilename}`;

    // If replacing old image, clean up old file
    if (oldImageUrl && oldImageUrl !== relativeUrl) {
      deleteLocalUploadFile(oldImageUrl);
    }

    // If targetFolder is 'media', insert record into media MySQL table
    let mediaId = null;
    if (targetFolder === 'media') {
      try {
        const res = await query(`
          INSERT INTO media (filename, original_name, url, mime_type, size_bytes, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?);
        `, [safeFilename, cleanOriginal, relativeUrl, parsed.mimeType, parsed.size, userId]);
        mediaId = res.insertId;
      } catch (dbErr) {
        console.warn('[saveUploadedImageFile] Media DB insert error:', dbErr.message);
      }
    }

    return {
      success: true,
      url: relativeUrl,
      filename: safeFilename,
      originalName: cleanOriginal,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.size,
      formattedSize: formatBytes(parsed.size),
      mediaId
    };
  } catch (err) {
    console.error(`[saveUploadedImageFile] Write error in ${targetFolder}:`, err);
    return { success: false, error: 'Failed to write image file to persistent server storage.' };
  }
}

