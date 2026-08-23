import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { projectApiKeyAuth } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { createStorageAdapterFromConfig } from '../services/storage.js';
import { success } from '../utils/response.js';
import { PayloadTooLargeError, UnsupportedMediaError, NotFoundError } from '../utils/errors.js';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE },
});

const allowedTypes = env.ALLOWED_FILE_TYPES.split(',');

const MAGIC_BYTES: { mime: string; check: (buf: Buffer) => boolean }[] = [
  { mime: 'image/png', check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', check: (b) => b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a') },
  { mime: 'image/webp', check: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', check: (b) => b.length >= 4 && b.toString('ascii', 0, 4) === '%PDF' },
];

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function detectRealMimeType(buf: Buffer): string | null {
  for (const { mime, check } of MAGIC_BYTES) {
    if (check(buf)) return mime;
  }
  return null;
}

uploadRouter.post('/', projectApiKeyAuth, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return next(new UnsupportedMediaError('未提供文件'));
    }

    if (file.size > env.MAX_FILE_SIZE) {
      return next(new PayloadTooLargeError());
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return next(new UnsupportedMediaError(`不支持的文件类型: ${file.mimetype}`));
    }

    // Verify file content via magic bytes (do not trust client Content-Type)
    const realMime = detectRealMimeType(file.buffer);
    if (!realMime || !allowedTypes.includes(realMime)) {
      return next(new UnsupportedMediaError('文件内容与声明的类型不匹配'));
    }

    // Use server-determined extension based on real MIME type
    const safeExt = EXT_BY_MIME[realMime] ?? (path.extname(file.originalname) || '');
    const safeFilename = `${path.basename(file.originalname, path.extname(file.originalname))}${safeExt}`;

    const storage = await createStorageAdapterFromConfig(req.project!.org_id);
    const result = await storage.upload(file.buffer, safeFilename, realMime);

    const attachment = await prisma.attachment.create({
      data: {
        filename: file.originalname,
        url: result.url,
        size: file.size,
        mime_type: realMime,
        project_id: req.projectId!,
      },
    });

    success(res, {
      id: attachment.id,
      url: attachment.url,
      filename: attachment.filename,
      size: attachment.size,
      mime_type: attachment.mime_type,
    }, 201);
  } catch (err) {
    next(err);
  }
});

uploadRouter.get('/files/:id', async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });
    if (!attachment) {
      return next(new NotFoundError('附件不存在'));
    }

    // For S3/Qiniu URLs (absolute), redirect to the stored URL
    if (attachment.url.startsWith('http')) {
      return res.redirect(attachment.url);
    }

    // For local storage, serve the file from disk
    const key = attachment.url.replace(/^\/uploads\//, '');
    const filePath = path.join(env.LOCAL_UPLOAD_DIR, key);

    try {
      await fs.access(filePath);
    } catch {
      return next(new NotFoundError('文件不存在'));
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const isPdf = attachment.mime_type === 'application/pdf';
    res.setHeader('Content-Disposition', `${isPdf ? 'attachment' : 'inline'}; filename="${encodeURIComponent(attachment.filename)}"`);
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
});
