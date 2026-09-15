'use client';

import { useRef, useState } from 'react';
import { Download, FileUp, FileDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv, normalizeOptionalDate, parseCsv, toCsv } from '@/lib/csv';
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

export type CsvSelectOption = { value: string; label: string };

export type CsvColumn = {
  key: string;
  header: string;
  aliases?: readonly string[];
  required?: boolean;
  sample?: string;
  /** Preview editor type */
  type?: 'text' | 'select' | 'money' | 'period' | 'date';
  options?: readonly CsvSelectOption[];
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
  exportRows: Array<Record<string, string>>;
  validateRow: (row: Record<string, string>, index: number) => string[];
  onImport: (rows: Array<Record<string, string>>) => Promise<void | boolean>;
  className?: string;
};

function rebuildPreview(
  rows: Array<Record<string, string>>,
  validateRow: CsvDataTransferProps['validateRow'],
): CsvPreviewRow[] {
  return rows.map((values, index) => ({
    values,
    errors: validateRow(values, index),
  }));
}

export function CsvDataTransfer({
  title,
  filenamePrefix,
  columns,
  sampleRows,
  exportRows,
  validateRow,
  onImport,
  className,
}: CsvDataTransferProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const defaultSample =
    sampleRows ??
    [
      Object.fromEntries(
        columns.map((col) => [col.key, col.sample ?? '']),
      ),
    ];

  const handleDownloadTemplate = () => {
    const csv = toCsv(
      columns.map((c) => c.header),
      defaultSample.map((row) => columns.map((c) => row[c.key] ?? '')),
    );
    downloadCsv(`${filenamePrefix}-mau.csv`, csv);
    toast.success('Đã tải file mẫu');
  };

  const handleExport = () => {
    if (exportRows.length === 0) {
      toast.error('Chưa có dữ liệu để xuất');
      return;
    }
    const csv = toCsv(
      columns.map((c) => c.header),
      exportRows.map((row) => columns.map((c) => row[c.key] ?? '')),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filenamePrefix}-${stamp}.csv`, csv);
    toast.success(`Đã xuất ${exportRows.length} dòng`);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) {
      toast.error('File CSV trống hoặc không đọc được');
      return;
    }

    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
    const missingRequired = columns.filter((col) => {
      if (!col.required) return false;
      const names = [col.key, col.header, ...(col.aliases ?? [])].map((n) =>
        n.toLowerCase(),
      );
      return !names.some((n) => normalizedHeaders.includes(n));
    });
    if (missingRequired.length > 0) {
      toast.error(
        `Thiếu cột bắt buộc: ${missingRequired.map((c) => c.header).join(', ')}`,
      );
      return;
    }

    const mapped = rows.map((row) => {
      const values: Record<string, string> = {};
      for (const col of columns) {
        const names = [col.key, col.header, ...(col.aliases ?? [])].map((n) =>
          n.toLowerCase(),
        );
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
      toast.error(err instanceof Error ? err.message : 'Nhập file thất bại');
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
        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" />
          File mẫu
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Xuất CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          Nhập CSV
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
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
                  {errorCount > 0 ? ` · ${errorCount} lỗi` : ''} — có thể chọn
                  lại trạng thái / kỳ / số tiền trước khi nhập
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
                        <TableHead key={col.key}>{col.header}</TableHead>
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
  startYear = new Date().getFullYear() - 1,
  endYear = new Date().getFullYear() + 1,
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
