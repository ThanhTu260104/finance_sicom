import type { Request, Response } from 'express';
import type { Readable } from 'stream';

export function resolveTrackStreamMimeType(
  storedPath: string,
  dbMime: string | null | undefined,
): string {
  const ext = storedPath.includes('.')
    ? storedPath.slice(storedPath.lastIndexOf('.')).toLowerCase()
    : '';
  const byExt: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mov': 'video/quicktime',
    '.mp4': 'audio/mp4',
  };
  const fromDb = dbMime?.trim().toLowerCase();
  if (
    fromDb &&
    fromDb !== 'application/octet-stream' &&
    fromDb !== 'binary/octet-stream'
  ) {
    return fromDb;
  }
  if (ext === '.mp4') return 'audio/mp4';
  return byExt[ext] ?? 'audio/mpeg';
}

/** Parse `Range: bytes=0-499` — trả null nếu không hợp lệ hoặc không phải bytes. */
export function parseByteRange(
  rangeHeader: string | undefined,
  totalSize: number,
): { start: number; end: number } | null {
  if (!rangeHeader?.startsWith('bytes=') || totalSize < 1) return null;
  const spec = rangeHeader.slice('bytes='.length).trim();
  const dash = spec.indexOf('-');
  if (dash < 0) return null;
  const startStr = spec.slice(0, dash).trim();
  const endStr = spec.slice(dash + 1).trim();

  let start: number;
  let end: number;

  if (startStr === '') {
    const suffix = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix < 1) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr ? Number.parseInt(endStr, 10) : totalSize - 1;
    if (!Number.isFinite(start) || start < 0) return null;
    if (!Number.isFinite(end) || end < start) return null;
    end = Math.min(end, totalSize - 1);
  }

  if (start >= totalSize) return null;
  return { start, end };
}

export async function pipeTrackMediaWithRange(
  req: Request,
  res: Response,
  input: {
    mimeType: string;
    fileName: string;
    totalSize: number;
    openStream: (
      range?: { start: number; end: number },
    ) => Readable | Promise<Readable>;
  },
): Promise<void> {
  const { mimeType, fileName, totalSize, openStream } = input;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fileName)}"`,
  );
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const range = parseByteRange(req.headers.range, totalSize);

  if (!range) {
    res.setHeader('Content-Length', String(totalSize));
    res.status(200);
    (await openStream()).pipe(res);
    return;
  }

  const { start, end } = range;
  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
  res.setHeader('Content-Length', String(chunkSize));
  (await openStream({ start, end })).pipe(res);
}
