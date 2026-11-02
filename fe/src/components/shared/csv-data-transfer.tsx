'use client';

import { useRef, useState } from 'react';
import { Download, FileUp, FileDown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { normalizeOptionalDate } from '@/lib/csv';
import {
  formatGroupedNumber,
  parseGroupedNumber,
} from '@/lib/number-format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCanWrite } from '@/components/auth/auth-provider';

export type CsvSelectOption = { value: string; label: string };

export type CsvColumn = {
  key: string;
  header: string;
  aliases?: readonly string[];
  required?: boolean;
  sample?: string;
  /** Preview editor type */
  type?: 'text' | 'select' | 'multi-select' | 'money' | 'period' | 'date';
  options?: readonly CsvSelectOption[];
  /** Separator for multi-select values (default ";") */
  multiSeparator?: string;
};

export type CsvPreviewRow = {
  values: Record<string, string>;
  errors: string[];
};

type CsvDataTransferProps = {
  title: string;
  filenamePrefix: string;
  columns: readonly CsvColumn[];
  sampleRows?: Array<Record<string, string>>;
  /** Dòng xuất tức thì (vd. trang hiện tại). Bỏ qua nếu có `onExport`. */
  exportRows?: Array<Record<string, string>>;
  /** Gom đủ dữ liệu trước khi xuất (vd. mọi trang + bộ lọc). */
  onExport?: () => Promise<Array<Record<string, string>>>;
  validateRow: (row: Record<string, string>, index: number) => string[];
  onImport: (rows: Array<Record<string, string>>) => Promise<void | boolean>;
  className?: string;
  /** Chỉ xuất / mẫu — ẩn nút nhập Excel */
  hideImport?: boolean;
  hideTemplate?: boolean;
};

function excelHeader(col: CsvColumn) {
  return col.required ? `${col.header} (*)` : col.header;
}

/** Bỏ dấu tiếng Việt để khớp header Excel (Truong du an ≈ TruongDuAn). */
function foldHeaderAscii(header: string) {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd');
}

/** Normalize Excel header for matching: trim, lower, strip (*) / *, bỏ dấu & khoảng trắng */
function normalizeHeaderKey(header: string) {
  return foldHeaderAscii(
    header
      .trim()
      .toLowerCase()
      .replace(/\s*\(\*\)\s*$/g, '')
      .replace(/\s*\*+\s*$/g, '')
      .trim(),
  ).replace(/\s+/g, '');
}

function columnMatchNames(col: CsvColumn) {
  return [col.key, col.header, excelHeader(col), ...(col.aliases ?? [])].map(
    (n) => normalizeHeaderKey(n),
  );
}

function rebuildPreview(
  rows: Array<Record<string, string>>,
  validateRow: CsvDataTransferProps['validateRow'],
): CsvPreviewRow[] {
  return rows.map((values, index) => ({
    values,
    errors: validateRow(values, index),
  }));
}

function sanitizeExcelSheetName(name: string, used: Set<string>) {
  let base = name.replace(/[\\/*?:[\]]/g, '_').trim() || 'Sheet';
  if (base.length > 31) base = base.slice(0, 31);
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) {
    const suffix = `_${n++}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function setSheetColWidths(sheet: XLSX.WorkSheet, headers: string[], rows: string[][]) {
  sheet['!cols'] = headers.map((header, index) => ({
    wch: Math.max(
      header.length + 2,
      ...rows.map((row) => String(row[index] ?? '').length + 2),
      14,
    ),
  }));
}

export function downloadExcel(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setSheetColWidths(sheet, headers, rows);
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    sanitizeExcelSheetName('Du lieu', used),
  );
  XLSX.writeFile(workbook, filename, { compression: true });
}

/** Template: sheet dữ liệu + sheet danh mục cho từng cột select (MaLoai, …). */
function downloadTemplateExcel(
  filename: string,
  columns: readonly CsvColumn[],
  dataRows: Array<Record<string, string>>,
) {
  const headers = columns.map(excelHeader);
  const matrix = dataRows.map((row) =>
    columns.map((c) => row[c.key] ?? ''),
  );
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...matrix]);
  setSheetColWidths(dataSheet, headers, matrix);
  XLSX.utils.book_append_sheet(
    workbook,
    dataSheet,
    sanitizeExcelSheetName('Du lieu', used),
  );

  for (const col of columns) {
    if (
      (col.type !== 'select' && col.type !== 'multi-select') ||
      !col.options?.length
    ) {
      continue;
    }
    const refHeaders = ['Ma (nhap vao cot)', 'Mo ta'];
    const refRows = col.options.map((opt) => [opt.value, opt.label]);
    const refSheet = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);
    setSheetColWidths(refSheet, refHeaders, refRows);
    const sheetTitle = col.header || col.key;
    XLSX.utils.book_append_sheet(
      workbook,
      refSheet,
      sanitizeExcelSheetName(sheetTitle, used),
    );
  }

  XLSX.writeFile(workbook, filename, { compression: true });
}

function buildDefaultTemplateRows(
  columns: readonly CsvColumn[],
  sampleRows?: Array<Record<string, string>>,
): Array<Record<string, string>> {
  if (sampleRows?.length) return sampleRows;

  const base = Object.fromEntries(
    columns.map((col) => [col.key, col.sample ?? '']),
  );

  const selectWithOpts = columns.find(
    (c) =>
      (c.type === 'select' || c.type === 'multi-select') &&
      c.options &&
      c.options.length > 0,
  );

  if (!selectWithOpts?.options?.length) {
    return [base];
  }

  const maxExamples = Math.min(selectWithOpts.options.length, 5);
  return selectWithOpts.options.slice(0, maxExamples).map((opt) => ({
    ...base,
    [selectWithOpts.key]: opt.value,
  }));
}

function formatImportError(err: unknown): string {
  if (!(err instanceof Error)) return 'Nhập file thất bại';
  const details =
    'details' in err
      ? (err as Error & { details?: { message?: string | string[] } }).details
      : undefined;
  const raw = details?.message ?? err.message;
  if (Array.isArray(raw)) return raw.join(' · ');
  return String(raw || 'Nhập file thất bại');
}

export function CsvDataTransfer({
  title,
  filenamePrefix,
  columns,
  sampleRows,
  exportRows = [],
  onExport,
  validateRow,
  onImport,
  className,
  hideImport: hideImportProp = false,
  hideTemplate: hideTemplateProp = false,
}: CsvDataTransferProps) {
  // Tài khoản chỉ xem: chỉ xuất file, không nhập / tải mẫu nhập
  const writable = useCanWrite();
  const hideImport = hideImportProp || !writable;
  const hideTemplate = hideTemplateProp || !writable;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const templateRows = buildDefaultTemplateRows(columns, sampleRows);

  const handleDownloadTemplate = () => {
    const hasOptionSheets = columns.some(
      (c) =>
        (c.type === 'select' || c.type === 'multi-select') &&
        (c.options?.length ?? 0) > 0,
    );
    downloadTemplateExcel(
      `${filenamePrefix}-mau.xlsx`,
      columns,
      templateRows,
    );
    toast.success(
      hasOptionSheets
        ? 'Đã tải file mẫu — sheet “Du lieu” + sheet danh mục (MaLoai…); cột (*) là bắt buộc'
        : 'Đã tải file mẫu — cột có (*) là bắt buộc',
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = onExport ? await onExport() : exportRows;
      if (rows.length === 0) {
        toast.error('Chưa có dữ liệu để xuất');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadExcel(
        `${filenamePrefix}-${stamp}.xlsx`,
        columns.map(excelHeader),
        rows.map((row) => columns.map((c) => row[c.key] ?? '')),
      );
      toast.success(`Đã xuất ${rows.length} dòng`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Không xuất được file Excel',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        cellDates: false,
      });
      const dataSheetName =
        workbook.SheetNames.find(
          (n) => normalizeHeaderKey(n) === 'dulieu',
        ) ?? workbook.SheetNames[0];
      const sheet = dataSheetName ? workbook.Sheets[dataSheetName] : undefined;
      const matrix = sheet
        ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: '',
            raw: false,
          })
        : [];
      const headers = (matrix[0] ?? []).map((cell) => String(cell ?? ''));
      const rows = matrix
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
        .map((row) => row.map((cell) => String(cell ?? '')));
      if (headers.length === 0) {
        toast.error('File Excel trống hoặc không đọc được');
        return;
      }

      const normalizedHeaders = headers.map(normalizeHeaderKey);
      const missingRequired = columns.filter((col) => {
        if (!col.required) return false;
        const names = columnMatchNames(col);
        return !names.some((n) => normalizedHeaders.includes(n));
      });
      if (missingRequired.length > 0) {
        toast.error(
          `Thiếu cột bắt buộc (*): ${missingRequired.map((c) => c.header).join(', ')}`,
        );
        return;
      }

      const mapped = rows.map((row) => {
        const values: Record<string, string> = {};
        for (const col of columns) {
          const names = columnMatchNames(col);
          const idx = normalizedHeaders.findIndex((h) => names.includes(h));
          let cell = idx >= 0 ? (row[idx] ?? '').trim() : '';
          if (col.type === 'money' && cell) {
            cell = parseGroupedNumber(cell) || cell;
          }
          if (col.type === 'select' && col.options?.length && cell) {
            const match = col.options.find(
              (opt) =>
                opt.value.toLowerCase() === cell.toLowerCase() ||
                opt.label.toLowerCase() === cell.toLowerCase(),
            );
            if (match) cell = match.value;
          }
          if (col.type === 'multi-select' && col.options?.length && cell) {
            const sep = col.multiSeparator ?? ';';
            const resolved = cell
              .split(sep)
              .map((part) => part.trim())
              .filter(Boolean)
              .map((part) => {
                const match = col.options!.find(
                  (opt) =>
                    opt.value.toLowerCase() === part.toLowerCase() ||
                    opt.label.toLowerCase() === part.toLowerCase(),
                );
                return match?.value ?? part;
              });
            cell = [...new Set(resolved)].join(sep);
          }
          if (col.type === 'date' && cell) {
            cell = normalizeOptionalDate(cell);
          }
          values[col.key] = cell;
        }
        return values;
      });

      if (mapped.length === 0) {
        toast.error('File không có dòng dữ liệu');
        return;
      }

      setPreview(rebuildPreview(mapped, validateRow));
      setFileName(file.name);
      setOpen(true);
    } catch {
      toast.error('Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ.');
    }
  };

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setPreview((prev) => {
      const nextValues = prev.map((row, index) =>
        index === rowIndex
          ? { ...row.values, [key]: value }
          : { ...row.values },
      );
      return rebuildPreview(nextValues, validateRow);
    });
  };

  const errorCount = preview.filter((row) => row.errors.length > 0).length;
  const validRows = preview.filter((row) => row.errors.length === 0);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      toast.error('Không có dòng hợp lệ để nhập');
      return;
    }
    setImporting(true);
    try {
      const completed = await onImport(
        validRows.map((row) => {
          const normalized = { ...row.values };
          for (const col of columns) {
            if (col.type === 'money' && normalized[col.key]) {
              normalized[col.key] =
                parseGroupedNumber(normalized[col.key]) || normalized[col.key];
            }
          }
          return normalized;
        }),
      );
      if (completed === false) return;
      toast.success(`Đã nhập ${validRows.length} dòng`);
      setOpen(false);
      setPreview([]);
      setFileName('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      toast.error(formatImportError(err), { duration: 8000 });
    } finally {
      setImporting(false);
    }
  };

  const renderEditor = (
    col: CsvColumn,
    rowIndex: number,
    value: string,
  ) => {
    if (col.type === 'select' && col.options) {
      return (
        <Select
          className="h-9 min-w-[140px]"
          value={value}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
        >
          <option value="">— Chọn —</option>
          {col.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    }

    if (col.type === 'multi-select' && col.options) {
      const sep = col.multiSeparator ?? ';';
      const selected = new Set(
        value
          .split(sep)
          .map((p) => p.trim())
          .filter(Boolean),
      );
      return (
        <div className="flex min-w-[180px] flex-col gap-1.5 py-1">
          {col.options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300"
                checked={selected.has(opt.value)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  updateCell(rowIndex, col.key, [...next].join(sep));
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }

    if (col.type === 'money') {
      return (
        <MoneyInput
          className="h-9 min-w-[140px]"
          value={value}
          onChange={(next) => updateCell(rowIndex, col.key, next)}
        />
      );
    }

    if (col.type === 'date') {
      return (
        <Input
          type="date"
          className="h-9 min-w-[140px]"
          value={value}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
        />
      );
    }

    if (col.type === 'period') {
      if (col.options?.length) {
        return (
          <Select
            className="h-9 min-w-[120px]"
            value={value}
            onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
          >
            <option value="">— Chọn kỳ —</option>
            {col.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        );
      }
      return (
        <Input
          className="h-9 min-w-[110px]"
          placeholder="YYYY-MM"
          value={value}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
        />
      );
    }

    return (
      <Input
        className="h-9 min-w-[120px]"
        value={value}
        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
      />
    );
  };

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        {hideTemplate ? null : (
          <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" />
            File mẫu
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Xuất Excel
        </Button>
        {hideImport ? null : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              Nhập Excel
            </Button>
            <span className="self-center text-xs text-slate-500">
              Cột <span className="font-medium">(*)</span> = bắt buộc
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Xem trước / chỉnh sửa nhập {title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  File: {fileName || '—'} · {preview.length} dòng ·{' '}
                  {validRows.length} hợp lệ
                  {errorCount > 0 ? ` · ${errorCount} lỗi` : ''} — cột có{' '}
                  <span className="font-medium">(*)</span> là bắt buộc
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {columns.map((col) => (
                        <TableHead key={col.key}>
                          {excelHeader(col)}
                        </TableHead>
                      ))}
                      <TableHead>Kiểm tra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, index) => (
                      <TableRow
                        key={`${index}-${row.values[columns[0]?.key] ?? ''}`}
                        className={
                          row.errors.length > 0 ? 'bg-red-50/70' : undefined
                        }
                      >
                        <TableCell className="text-slate-500">
                          {index + 1}
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell key={col.key}>
                            {renderEditor(col, index, row.values[col.key] ?? '')}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <span className="text-sm text-emerald-700">OK</span>
                          ) : (
                            <span className="text-sm text-red-600">
                              {row.errors.join('; ')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {errorCount > 0 ? (
                <p className="mt-3 text-sm text-amber-700">
                  Sửa các dòng lỗi bằng ô chọn/ô nhập bên trên, hoặc bỏ qua — chỉ
                  nhập {validRows.length} dòng hợp lệ.
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Kiểm tra xong thì bấm Xác nhận nhập.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                disabled={importing}
              >
                Hủy
              </Button>
              <Button
                onClick={() => void handleConfirmImport()}
                disabled={importing || validRows.length === 0}
              >
                {importing
                  ? 'Đang nhập...'
                  : `Xác nhận nhập (${validRows.length})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Generate YYYY-MM options for import selects. */
export function buildPeriodOptions(
  startYear = new Date().getFullYear() - 15,
  endYear = new Date().getFullYear() + 15,
) {
  const options: CsvSelectOption[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${y}-${String(m).padStart(2, '0')}`;
      options.push({ value, label: `${String(m).padStart(2, '0')}/${y}` });
    }
  }
  return options;
}

export function moneyDisplay(value: string) {
  return formatGroupedNumber(value) || value;
}
