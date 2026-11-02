/** Dấu hiệu UTF-8 bị hiểu nhầm thành Latin-1 (vd. PhÃ¢n, Äiá»u). */
const MOJIBAKE_HINT =
  /Ã.|Ä.|á»|Æ°|Ð|Ñ|â€|ï¿½/i;

/**
 * Sửa tên file từ multipart (multer/busboy thường trả Latin-1 thay vì UTF-8).
 */
export function fixUtf8Filename(name: string): string {
  const raw = name?.trim() ?? '';
  if (!raw) return raw;

  if (!MOJIBAKE_HINT.test(raw)) {
    return raw;
  }

  const fixed = Buffer.from(raw, 'latin1').toString('utf8');
  if (!fixed || fixed.includes('\uFFFD')) {
    return raw;
  }
  return fixed;
}

/** Header Content-Disposition an toàn với tên tiếng Việt (RFC 5987). */
export function contentDispositionAttachment(fileName: string): string {
  const safe = fixUtf8Filename(fileName);
  const asciiFallback =
    safe.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'") || 'download';
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
