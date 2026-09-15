/** Minimal CSV helpers for import/export (Excel-friendly UTF-8 BOM). */

import { parseGroupedNumber } from './number-format';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPeriod(value: string) {
  return PERIOD_RE.test(value.trim());
}

export function isValidAmount(value: string) {
  const normalized = parseGroupedNumber(value);
  return /^\d+(\.\d{1,2})?$/.test(normalized) && Number(normalized) >= 0;
}

export function normalizeAmount(value: string) {
  return parseGroupedNumber(value);
}

export function isValidOptionalDate(value: string) {
  const v = value.trim();
  if (!v) return true;
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function escapeCell(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Parse a single CSV line respecting quoted fields. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

export function mapCsvRows(
  headers: string[],
  rows: string[][],
  aliases: Record<string, string[]>,
): Array<Record<string, string>> {
  const indexByKey: Record<string, number> = {};
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  for (const [key, names] of Object.entries(aliases)) {
    const found = names
      .map((name) => normalizedHeaders.indexOf(name.toLowerCase()))
      .find((idx) => idx >= 0);
    if (found !== undefined && found >= 0) {
      indexByKey[key] = found;
    }
  }

  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const key of Object.keys(aliases)) {
      const idx = indexByKey[key];
      mapped[key] = idx === undefined ? '' : (row[idx] ?? '').trim();
    }
    return mapped;
  });
}
