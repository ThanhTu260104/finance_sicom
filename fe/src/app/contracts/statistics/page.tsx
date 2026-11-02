'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, FileText, Wrench, Settings2 } from 'lucide-react';
import { contractsApi, type ContractOverviewStatistics } from '@/lib/api';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import type { Contract, ContractType } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/format';
import { formatContractTypesDisplay } from '@/lib/contract-type';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { QueryState } from '@/components/shared/query-state';
import { ContractStatusBadge } from '@/components/shared/status-badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type DrillType = Extract<ContractType, 'OPERATION' | 'MAINTENANCE'>;

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  active,
  onClick,
}: {
  title: string;
  value: number | null;
  hint?: string;
  icon: typeof FileText;
  active?: boolean;
  onClick?: () => void;
}) {
  const interactive = onClick != null;
  return (
    <Card
      className={cn(
        'border-slate-200 shadow-sm transition-colors',
        interactive && 'cursor-pointer hover:border-slate-300 hover:bg-slate-50/80',
        active && 'border-slate-900 ring-2 ring-slate-900/10',
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums text-slate-900">
          {value == null ? '—' : value.toLocaleString('vi-VN')}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        ) : null}
        {interactive ? (
          <p className="mt-2 text-xs font-medium text-slate-600">
            {active ? '▾ Đang xem danh sách' : '▸ Bấm để xem danh sách'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const DRILL_LABEL: Record<DrillType, string> = {
  OPERATION: 'Hợp đồng vận hành',
  MAINTENANCE: 'Hợp đồng bảo trì',
};

export default function ContractStatisticsPage() {
  const [data, setData] = useState<ContractOverviewStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillType | null>(null);
  const [list, setList] = useState<Contract[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    contractsApi
      .overviewStatistics()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Không tải được thống kê');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDrillList = useCallback(async (type: DrillType) => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await fetchAllPaginated((page, limit) =>
        contractsApi.list({ page, limit, contractType: type }),
      );
      setList(rows);
    } catch (e) {
      setList([]);
      setListError(
        e instanceof Error ? e.message : 'Không tải được danh sách HĐ',
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!drill) {
      setList([]);
      setListError(null);
      return;
    }
    void loadDrillList(drill);
  }, [drill, loadDrillList]);

  const toggleDrill = (type: DrillType) => {
    setDrill((prev) => (prev === type ? null : type));
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Hợp đồng', href: '/contracts' },
          { label: 'Thống kê' },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Thống kê hợp đồng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tổng quan khách hàng và phân loại hợp đồng vận hành / bảo trì.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/contracts/maintenance">Theo dõi bảo trì theo ngày</Link>
        </Button>
      </div>

      <QueryState loading={loading} error={error} empty={false}>
        {data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Khách hàng (KST)"
              value={data.customerCount}
              hint="Khách hàng đang quản lý trên hệ thống"
              icon={Building2}
            />
            <StatCard
              title="Tổng hợp đồng"
              value={data.contractCount}
              hint="Hợp đồng chưa xóa"
              icon={FileText}
            />
            <StatCard
              title="Hợp đồng vận hành"
              value={data.operationContractCount}
              hint="Có loại Vận hành (kể cả HĐ kép)"
              icon={Settings2}
              active={drill === 'OPERATION'}
              onClick={() => toggleDrill('OPERATION')}
            />
            <StatCard
              title="Hợp đồng bảo trì"
              value={data.maintenanceContractCount}
              hint="Có loại Bảo trì (kể cả HĐ kép)"
              icon={Wrench}
              active={drill === 'MAINTENANCE'}
              onClick={() => toggleDrill('MAINTENANCE')}
            />
          </div>
        ) : null}
      </QueryState>

      {drill ? (
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base">{DRILL_LABEL[drill]}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDrill(null)}
            >
              Đóng
            </Button>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <QueryState
              loading={listLoading}
              error={listError}
              empty={!listLoading && !listError && list.length === 0}
              emptyMessage="Không có hợp đồng thuộc loại này."
              onRetry={() => drill && void loadDrillList(drill)}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số HĐ</TableHead>
                      <TableHead>Tên HĐ</TableHead>
                      <TableHead>Dự án</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/contracts/${c.id}?tab=info`}
                            className="text-slate-900 hover:underline"
                          >
                            {c.contractNo}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[16rem] whitespace-normal break-words">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          {c.project ? (
                            <span className="text-sm">
                              <span className="font-medium text-slate-900">
                                {c.project.name}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {c.project.code}
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatContractTypesDisplay(c.contractType)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyVND(c.contractValue)}
                        </TableCell>
                        <TableCell>
                          <ContractStatusBadge status={c.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </QueryState>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
