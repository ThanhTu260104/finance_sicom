import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';

/** Giới hạn riêng ca khúc — tránh buffer RAM quá lớn khi upload. */
export const MUSIC_TRACK_MAX_BYTES = 100 * 1024 * 1024;

const uploadsRoot = join(process.cwd(), 'uploads', 'music-tracks');

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Tạo mới: file tạm, service chuyển vào thư mục track sau khi có id. */
export const musicTrackIncomingStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(uploadsRoot, '_incoming');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.mp3';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

/** Upload lại: ghi thẳng vào uploads/music-tracks/{id}/audio.ext */
export const musicTrackByIdStorage = diskStorage({
  destination: (req: Request, _file, cb) => {
    const raw = req.params?.id;
    const id = typeof raw === 'string' ? raw : raw?.[0];
    if (!id) {
      cb(new Error('Missing track id') as Error, '');
      return;
    }
    const dir = join(uploadsRoot, id);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.mp3';
    cb(null, `audio${ext}`);
  },
});
