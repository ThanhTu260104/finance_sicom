'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type StatsRow = {
  label: string;
  value: string;
  hint?: string;
};

export function StatsTable({
  rows,
  className,
}: {
  rows: StatsRow[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-slate-200',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[42%] py-2 text-xs">Chỉ tiêu</TableHead>
            <TableHead className="py-2 text-xs">Giá trị</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label} className="hover:bg-slate-50/80">
              <TableCell className="whitespace-normal py-2 text-sm font-medium text-slate-600">
                {row.label}
              </TableCell>
              <TableCell className="whitespace-normal py-2">
                <p className="text-base font-semibold text-slate-900">
                  {row.value}
                </p>
                {row.hint ? (
                  <p className="mt-0.5 text-xs text-slate-500">{row.hint}</p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
