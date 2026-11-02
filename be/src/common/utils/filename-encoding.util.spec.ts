import {
  contentDispositionAttachment,
  fixUtf8Filename,
} from './filename-encoding.util';

describe('fixUtf8Filename', () => {
  it('sửa tên tiếng Việt bị Latin-1 (multer)', () => {
    const correct =
      'Sicom.adm.260929.QĐ Điều động & Phân công NHC.pdf';
    const mojibake = Buffer.from(correct, 'utf8').toString('latin1');
    expect(fixUtf8Filename(mojibake)).toBe(correct);
  });

  it('giữ nguyên tên ASCII', () => {
    expect(fixUtf8Filename('report-2026.pdf')).toBe('report-2026.pdf');
  });

  it('giữ nguyên tên UTF-8 đúng', () => {
    expect(fixUtf8Filename('Biên bản nghiệm thu.pdf')).toBe(
      'Biên bản nghiệm thu.pdf',
    );
  });
});

describe('contentDispositionAttachment', () => {
  it('có filename*=UTF-8', () => {
    const header = contentDispositionAttachment('Phân công.pdf');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent('Phân công.pdf'));
  });
});
