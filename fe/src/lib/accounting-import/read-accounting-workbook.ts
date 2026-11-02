import * as XLSX from 'xlsx';

export type AccountingWorkbookData = {
  sheetNames: string[];
  activeSheet: string;
  /** Full grid as strings (empty cells → '') */
  matrix: string[][];
};

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

export function readAccountingWorkbook(buffer: ArrayBuffer): AccountingWorkbookData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;
  const activeSheet = sheetNames[0] ?? '';
  const sheet = activeSheet ? workbook.Sheets[activeSheet] : undefined;
  const raw = sheet
    ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      })
    : [];
  const matrix = raw.map((row) =>
    (row ?? []).map((cell) => cellToString(cell)),
  );
  return { sheetNames, activeSheet, matrix };
}

export function readAccountingSheet(
  buffer: ArrayBuffer,
  sheetName: string,
): string[][] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return raw.map((row) => (row ?? []).map((cell) => cellToString(cell)));
}

export function excelColumnLabel(index: number): string {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export type AccountingTableSlice = {
  headers: string[];
  rows: string[][];
  columnCount: number;
  /** 1-based Excel row of header */
  headerExcelRow: number;
  /** 1-based Excel row of first data row */
  dataStartExcelRow: number;
};

/** `headerRow` / `dataStartRow` are 1-based Excel row numbers */
export function sliceAccountingTable(
  matrix: string[][],
  headerRow: number,
  dataStartRow: number,
): AccountingTableSlice {
  const headerIndex = Math.max(0, headerRow - 1);
  const dataIndex = Math.max(0, dataStartRow - 1);
  const headerCells = matrix[headerIndex] ?? [];
  const dataSlice = matrix.slice(dataIndex);
  const columnCount = Math.max(
    headerCells.length,
    ...dataSlice.map((r) => r.length),
    0,
  );
  const headers = Array.from({ length: columnCount }, (_, i) =>
    (headerCells[i] ?? '').trim() || `(cột ${excelColumnLabel(i)})`,
  );
  const rows = matrix
    .slice(dataIndex)
    .filter((row) => row.some((cell) => cellToString(cell) !== ''))
    .map((row) =>
      Array.from({ length: columnCount }, (_, i) => cellToString(row[i] ?? '')),
    );
  return {
    headers,
    rows,
    columnCount,
    headerExcelRow: headerRow,
    dataStartExcelRow: dataStartRow,
  };
}
