import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { projectApiKeyAuth } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { createStorageAdapter } from '../services/storage.js';
import { success } from '../utils/response.js';
import { PayloadTooLargeError, UnsupportedMediaError, NotFoundError } from '../utils/errors.js';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE },
});

const storage = createStorageAdapter();
const allowedTypes = env.ALLOWED_FILE_TYPES.split(',');

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

    const result = await storage.upload(file.buffer, file.originalname, file.mimetype);

    const attachment = await prisma.attachment.create({
      data: {
        filename: file.originalname,
        url: result.url,
        size: file.size,
        mime_type: file.mimetype,
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
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.filename)}"`);
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
});
