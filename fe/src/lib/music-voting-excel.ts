import * as XLSX from 'xlsx';

const CODE_HEADERS = [
  'macakhuc',
  'ma ca khuc',
  'songcode',
  'song code',
  'mã ca khúc',
  'ma bai',
];

function normalizeHeader(h: string) {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findCodeColumnIndex(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const key = normalizeHeader(String(headers[i] ?? ''));
    if (CODE_HEADERS.includes(key)) return i;
  }
  return 0;
}

/** Đọc cột mã ca khúc từ sheet đầu tiên. */
export function parseSongCodesFromExcelFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) {
          resolve([]);
          return;
        }
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
          header: 1,
          defval: '',
        });
        if (rows.length === 0) {
          resolve([]);
          return;
        }
        const headers = (rows[0] ?? []).map((c) => String(c));
        const col = findCodeColumnIndex(headers);
        const startRow =
          normalizeHeader(headers[col] ?? '') &&
          CODE_HEADERS.includes(normalizeHeader(headers[col] ?? ''))
            ? 1
            : 0;
        const codes: string[] = [];
        for (let r = startRow; r < rows.length; r++) {
          const raw = rows[r]?.[col];
          const code = String(raw ?? '').trim();
          if (code) codes.push(code);
        }
        resolve(codes);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được file Excel'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadCampaignTracksTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['maCaKhuc', 'ghiChu'],
    ['CA KHUC 01', 'Ví dụ — xóa dòng mẫu'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BinhChon');
  XLSX.writeFile(wb, 'mau-danh-sach-binh-chon-ca-khuc.xlsx');
}

const EMPLOYEE_CODE_HEADERS = [
  'manhanvien',
  'ma nhan vien',
  'employeecode',
  'employee code',
  'ma nv',
  'manv',
  'mã nhân viên',
];

const EMPLOYEE_NAME_HEADERS = [
  'hoten',
  'ho ten',
  'fullname',
  'full name',
  'ten nhan vien',
  'họ tên',
];

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const key = normalizeHeader(String(headers[i] ?? ''));
    if (aliases.includes(key)) return i;
  }
  return -1;
}

export type CampaignVoterExcelRow = {
  employeeCode: string;
  fullName?: string;
  email?: string;
};

/** Đọc mã (và tùy chọn họ tên) nhân viên từ sheet đầu tiên. */
export function parseVotersFromExcelFile(
  file: File,
): Promise<CampaignVoterExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) {
          resolve([]);
          return;
        }
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
          header: 1,
          defval: '',
        });
        if (rows.length === 0) {
          resolve([]);
          return;
        }
        const headers = (rows[0] ?? []).map((c) => String(c));
        let codeCol = findColumnIndex(headers, EMPLOYEE_CODE_HEADERS);
        if (codeCol < 0) codeCol = 0;
        const nameCol = findColumnIndex(headers, EMPLOYEE_NAME_HEADERS);
        const emailCol = findColumnIndex(headers, EMPLOYEE_EMAIL_HEADERS);
        const headerLooksLikeCode =
          normalizeHeader(headers[codeCol] ?? '') &&
          EMPLOYEE_CODE_HEADERS.includes(
            normalizeHeader(headers[codeCol] ?? ''),
          );
        const startRow = headerLooksLikeCode ? 1 : 0;
        const out: CampaignVoterExcelRow[] = [];
        for (let r = startRow; r < rows.length; r++) {
          const email =
            emailCol >= 0
              ? String(rows[r]?.[emailCol] ?? '').trim()
              : '';
          const code = String(rows[r]?.[codeCol] ?? '').trim();
          if (!email && !code) continue;
          const fullName =
            nameCol >= 0
              ? String(rows[r]?.[nameCol] ?? '').trim() || undefined
              : undefined;
          out.push({
            employeeCode: code || email.split('@')[0] || email,
            fullName,
            email: email || undefined,
          });
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được file Excel'));
    reader.readAsArrayBuffer(file);
  });
}

const EMPLOYEE_EMAIL_HEADERS = [
  'email',
  'e-mail',
  'mail',
  'thu dien tu',
  'thu điện tử',
];

export function downloadCampaignVotersTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['maNhanVien', 'hoTen', 'email'],
    ['NV001', 'Nguyễn Văn A', 'nhanvien@congty.com — xóa dòng mẫu'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NhanVien');
  XLSX.writeFile(wb, 'mau-whitelist-nhan-vien-binh-chon.xlsx');
}
