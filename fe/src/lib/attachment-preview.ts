export type AttachmentPreviewMode = 'pdf' | 'image' | 'none';

export function attachmentPreviewMode(
  mimeType: string,
  fileName: string,
): AttachmentPreviewMode {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    mime.startsWith('image/') ||
    /\.(png|jpe?g)$/i.test(fileName)
  ) {
    return 'image';
  }
  return 'none';
}

export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
