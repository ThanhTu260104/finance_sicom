'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { acceptancesApi } from '@/lib/api';
import { contractsApi } from '@/lib/api/contracts';
import {
  buildContractLookupIndex,
  enrichAccountingImportRows,
  summarizeImportRows,
} from '@/lib/accounting-import/enrich-import-rows';
import {
  detectAccountingHeaderRow,
  suggestDataStartExcelRow,
  suggestHeaderExcelRow,
} from '@/lib/accounting-import/detect-sheet-layout';
import {
  ACCOUNTING_FIELD_LABELS,
  matchAccountingHeaders,
} from '@/lib/accounting-import/expected-columns';
import { mapAccountingRows } from '@/lib/accounting-import/map-accounting-rows';
import { normalizeContractNo } from '@/lib/accounting-import/normalize-contract-no';
import {
  excelColumnLabel,
  readAccountingSheet,
  readAccountingWorkbook,
  sliceAccountingTable,
} from '@/lib/accounting-import/read-accounting-workbook';
import { formatCurrencyVND, formatPeriod } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Chỉ rút gọn bảng raw trước khi xác nhận — không giới hạn import */
const RAW_PREVIEW_SAMPLE = 20;

type Props = {
  /** Chỉ import dòng thuộc HĐ này (trang chi tiết hợp đồng) */
  onlyContractNo?: string;
  /** Hiển thị số dòng khớp HĐ (nhập nhanh khi đã chọn HĐ) */
  highlightContractNo?: string;
  onImported?: () => void;
};

export function AccountingAcceptanceImport({
  onlyContractNo,
  highlightContractNo,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(2);
  const [dataStartRow, setDataStartRow] = useState(3);
  const [structureConfirmed, setStructureConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [contractLookup, setContractLookup] = useState<Map<
    string,
    { contractNo: string; projectCode: string | null }
  > | null>(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  const applyMatrix = useCallback(
    (next: string[][], detectedHeader0: number) => {
      setMatrix(next);
      const hExcel = suggestHeaderExcelRow(detectedHeader0);
      const dExcel = suggestDataStartExcelRow(detectedHeader0);
      setHeaderRow(hExcel);
      setDataStartRow(dExcel);
      setStructureConfirmed(false);
    },
    [],
  );

  const loadFile = async (file: File) => {
    const ab = await file.arrayBuffer();
    const wb = readAccountingWorkbook(ab);
    if (wb.matrix.length === 0) {
      toast.error('File Excel trống hoặc không đọc được');
      return;
    }
    setBuffer(ab);
    setFileName(file.name);
    setSheetNames(wb.sheetNames);
    setSheetName(wb.activeSheet);
    const header0 = detectAccountingHeaderRow(wb.matrix);
    applyMatrix(wb.matrix, header0);
    const dataStart = suggestDataStartExcelRow(header0);
    const dataRows = wb.matrix
      .slice(dataStart - 1)
      .filter((r) => r.some((c) => String(c ?? '').trim() !== '')).length;
    toast.success(
      `Sheet «${wb.activeSheet}»: ~${dataRows} dòng dữ liệu (tổng ${wb.matrix.length} dòng Excel)`,
    );
  };

  const slice = useMemo(() => {
    if (matrix.length === 0) return null;
    if (dataStartRow <= headerRow) return null;
    return sliceAccountingTable(matrix, headerRow, dataStartRow);
  }, [matrix, headerRow, dataStartRow]);

  const fieldMatches = useMemo(
    () => (slice ? matchAccountingHeaders(slice.headers) : []),
    [slice],
  );

  const missingCritical = useMemo(() => {
    const keys = ['contractNo', 'amountTotal'] as const;
    return fieldMatches.filter(
      (m) => keys.includes(m.key as (typeof keys)[number]) && m.columnIndex < 0,
    );
  }, [fieldMatches]);

  const mapped = useMemo(() => {
    if (!slice || !structureConfirmed) return null;
    return mapAccountingRows(slice.headers, slice.rows, {
      dataStartExcelRow: slice.dataStartExcelRow,
      onlyContractNo,
    });
  }, [slice, structureConfirmed, onlyContractNo]);

  useEffect(() => {
    if (!structureConfirmed) {
      setContractLookup(null);
      return;
    }
    let cancelled = false;
    setLookupLoading(true);
    contractsApi
      .importLookup()
      .then((rows) => {
        if (!cancelled) {
          setContractLookup(buildContractLookupIndex(rows));
        }
      })
      .catch(() => {
        toast.error('Không tải được danh sách hợp đồng để đối chiếu');
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [structureConfirmed]);

  const enrichedMapped = useMemo(() => {
    if (!mapped || !contractLookup) return null;
    return enrichAccountingImportRows(mapped, contractLookup);
  }, [mapped, contractLookup]);

  const importStats = useMemo(() => {
    if (!enrichedMapped) return null;
    return summarizeImportRows(enrichedMapped);
  }, [enrichedMapped]);

  const tableRows = useMemo(() => {
    if (!enrichedMapped) return [];
    if (!showOnlyIssues) return enrichedMapped;
    return enrichedMapped.filter(
      (r) => r.skipped || r.errors.length > 0 || r.warnings.length > 0,
    );
  }, [enrichedMapped, showOnlyIssues]);

  const contractMatchCount = useMemo(() => {
    const hint = highlightContractNo ?? onlyContractNo;
    if (!slice || !hint?.trim()) return null;
    const col = fieldMatches.find((m) => m.key === 'contractNo')?.columnIndex;
    if (col === undefined || col < 0) return null;
    const needle = normalizeContractNo(hint);
    return slice.rows.filter(
      (r) => normalizeContractNo(r[col] ?? '') === needle,
    ).length;
  }, [slice, highlightContractNo, onlyContractNo, fieldMatches]);

  const previewRows = slice?.rows.slice(0, RAW_PREVIEW_SAMPLE) ?? [];
  const layoutError =
    dataStartRow <= headerRow
      ? 'Dòng bắt đầu data phải lớn hơn dòng header.'
      : headerRow < 1
        ? 'Dòng header phải ≥ 1.'
        : null;

  const handleConfirmStructure = () => {
    if (!slice || layoutError) {
      toast.error(layoutError ?? 'Chưa có dữ liệu');
      return;
    }
    if (missingCritical.length > 0) {
      toast.error(
        'Thiếu cột bắt buộc: Số Hợp Đồng và/hoặc Tổng Thành Tiền. Chỉnh dòng header.',
      );
      return;
    }
    setStructureConfirmed(true);
    toast.success('Đã xác nhận cấu trúc — đang đối chiếu Số HĐ với hệ thống…');
  };

  const handleImport = async () => {
    if (!importStats || importStats.importable.length === 0) {
      toast.error('Không có dòng hợp lệ để import — xem dòng đỏ trong bảng');
      return;
    }
    if (importStats.invalid.length > 0) {
      const ok = window.confirm(
        `Còn ${importStats.invalid.length} dòng lỗi sẽ bỏ qua. Chỉ import ${importStats.importable.length} dòng hợp lệ. Tiếp tục?`,
      );
      if (!ok) return;
    }
    const items = importStats.importable.map((r) => r.payload!);
    setImporting(true);
    try {
      const result = await acceptancesApi.importAccounting(items, {
        onlyContractNo,
      });
      const msg = `Import xong: ${result.created} mới, ${result.updated} cập nhật${
        result.failed > 0 ? `, ${result.failed} lỗi` : ''
      }`;
      if (result.failed > 0) {
        const sample = result.errors
          .slice(0, 3)
          .map((e) => `${e.contractNo}: ${e.message}`)
          .join('\n');
        toast.warning(`${msg}\n${sample}`, { duration: 12000 });
      } else {
        toast.success(msg);
      }
      if (result.warnings.length > 0) {
        toast.message(`${result.warnings.length} cảnh báo (Mã DA lệch…)`, {
          duration: 6000,
        });
      }
      onImported?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Import nghiệm thu — file kế toán
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Bảng NT/thu công ty. Khóa upsert:{' '}
          <strong className="font-medium">Số HĐ + Ký hiệu HĐ</strong> (fallback
          Số Hóa đơn). Tiền = Tổng thành tiền (VAT). Đã thu → đồng bộ thu tự
          động.
          {onlyContractNo ? (
            <>
              {' '}
              Chế độ HĐ: chỉ ghi dòng khớp «{onlyContractNo}».
            </>
          ) : (
            <> Import toàn bộ HĐ có trong file.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="mr-1.5 h-4 w-4" />
          Chọn file Excel
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
            e.target.value = '';
          }}
        />
        {fileName ? (
          <span className="text-xs text-slate-600">{fileName}</span>
        ) : null}
      </div>

      {matrix.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sheetNames.length > 1 ? (
              <div className="space-y-1">
                <Label className="text-xs">Sheet</Label>
                <Select
                  value={sheetName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setSheetName(name);
                    if (buffer) {
                      const next = readAccountingSheet(buffer, name);
                      const header0 = detectAccountingHeaderRow(next);
                      applyMatrix(next, header0);
                    }
                  }}
                >
                  {sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Dòng header (Excel)</Label>
              <Input
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => {
                  setHeaderRow(Number(e.target.value) || 1);
                  setStructureConfirmed(false);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dòng bắt đầu data</Label>
              <Input
                type="number"
                min={2}
                value={dataStartRow}
                onChange={(e) => {
                  setDataStartRow(Number(e.target.value) || 2);
                  setStructureConfirmed(false);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (buffer && sheetName) {
                    const next = readAccountingSheet(buffer, sheetName);
                    const header0 = detectAccountingHeaderRow(next);
                    applyMatrix(next, header0);
                    toast.message('Đã gợi ý lại dòng header/data');
                  }
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Tự nhận dòng
              </Button>
            </div>
          </div>

          {layoutError ? (
            <p className="text-sm text-red-600">{layoutError}</p>
          ) : slice ? (
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {slice.rows.length} dòng dữ liệu sẽ được xử lý · header Excel
                dòng {slice.headerExcelRow}
              </span>
              {(highlightContractNo ?? onlyContractNo) &&
              contractMatchCount !== null ? (
                <span className="rounded bg-slate-100 px-2 py-0.5">
                  Khớp HĐ «{highlightContractNo ?? onlyContractNo}»:{' '}
                  {contractMatchCount} dòng
                </span>
              ) : null}
              {structureConfirmed ? (
                <span className="font-medium text-emerald-700">
                  ✓ Cấu trúc OK
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              Đối chiếu cột
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trường</TableHead>
                  <TableHead>Cột</TableHead>
                  <TableHead>Header file</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldMatches.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="text-xs">
                      {ACCOUNTING_FIELD_LABELS[m.key] ?? m.key}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'font-mono text-xs',
                        m.columnIndex < 0 && 'text-amber-700',
                      )}
                    >
                      {m.columnLetter ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {m.headerText ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {slice && previewRows.length > 0 && !structureConfirmed ? (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <p className="border-b bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Xem thử {previewRows.length} dòng đầu / tổng{' '}
                <strong>{slice.rows.length}</strong> dòng (import ghi đủ tổng
                số sau khi xác nhận)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    {slice.headers.slice(0, 12).map((h, i) => (
                      <TableHead key={i} className="text-[10px]">
                        {excelColumnLabel(i)} {h.slice(0, 20)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell className="text-xs">
                        {slice.dataStartExcelRow + ri}
                      </TableCell>
                      {row.slice(0, 12).map((cell, ci) => (
                        <TableCell
                          key={ci}
                          className="max-w-[120px] truncate text-[10px]"
                        >
                          {cell || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!slice || !!layoutError}
              onClick={handleConfirmStructure}
            >
              Xác nhận cấu trúc
            </Button>
          </div>

          {mapped && structureConfirmed ? (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              {lookupLoading || !importStats ? (
                <p className="text-sm text-slate-600">
                  Đang đối chiếu Số HĐ với hệ thống…
                </p>
              ) : (
                <>
              <p className="text-sm text-slate-700">
                Tổng <strong>{enrichedMapped!.length}</strong> dòng →{' '}
                <strong className="text-emerald-800">
                  {importStats.importable.length}
                </strong>{' '}
                sẽ import
                {importStats.noContract.length > 0 ? (
                  <>
                    {' '}
                    ·{' '}
                    <strong className="text-red-700">
                      {importStats.noContract.length}
                    </strong>{' '}
                    Số HĐ chưa có trong app
                  </>
                ) : null}
                {importStats.skipped.length > 0
                  ? ` · ${importStats.skipped.length} bỏ (HĐ khác)`
                  : ''}
                {importStats.invalid.length > importStats.noContract.length
                  ? ` · ${importStats.invalid.length - importStats.noContract.length} lỗi khác`
                  : ''}
              </p>
              {importStats.missingContractNos.length > 0 ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  <p className="font-medium">
                    {importStats.missingContractNos.length} Số HĐ trong file chưa
                    có trên phần mềm (cần tạo HĐ trước):
                  </p>
                  <p className="mt-1 max-h-24 overflow-y-auto font-mono leading-relaxed">
                    {importStats.missingContractNos.join(' · ')}
                  </p>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showOnlyIssues}
                  onChange={(e) => setShowOnlyIssues(e.target.checked)}
                />
                Chỉ hiển thị dòng lỗi / cảnh báo
              </label>
              <div className="max-h-[min(70vh,640px)] overflow-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Dòng</TableHead>
                      <TableHead className="text-xs">Số HĐ</TableHead>
                      <TableHead className="text-xs">Mã NT</TableHead>
                      <TableHead className="text-xs">Kỳ</TableHead>
                      <TableHead className="text-right text-xs">
                        Tiền
                      </TableHead>
                      <TableHead className="text-xs">Thu</TableHead>
                      <TableHead className="text-xs">Lỗi / cảnh báo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow
                        key={row.excelRow}
                        className={cn(
                          row.skipped && 'bg-slate-50 text-slate-400',
                          row.errors.length > 0 && 'bg-red-50',
                          row.errors.length === 0 &&
                            row.warnings.length > 0 &&
                            'bg-amber-50',
                          row.payload &&
                            !row.skipped &&
                            row.errors.length === 0 &&
                            'bg-emerald-50/40',
                        )}
                      >
                        <TableCell className="text-xs">{row.excelRow}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {row.payload?.contractNo ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.payload?.acceptanceNo ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.payload
                            ? formatPeriod(row.payload.period)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {row.payload
                            ? formatCurrencyVND(row.payload.amount)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.payload?.paymentStatus === 'COLLECTED'
                            ? 'Đã thu'
                            : row.payload
                              ? 'Chờ thu'
                              : '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-red-700">
                          {row.skipped
                            ? row.skipReason
                            : row.errors.join('; ') ||
                              row.warnings.join('; ') ||
                              '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={importing || importStats.importable.length === 0}
                onClick={() => void handleImport()}
              >
                {importing
                  ? 'Đang import…'
                  : `Import ${importStats.importable.length} nghiệm thu`}
              </Button>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
