'use client';

export type ChartContextItem = { label: string; value: string };

export function ChartContextBar({ items }: { items: ChartContextItem[] }) {
  return <HorizontalMetricStrip items={items} variant="modal" />;
}

/** Dải nhãn–giá trị ngang (panel HĐ, popup biểu đồ). */
export function HorizontalMetricStrip({
  items,
  variant = 'compact',
}: {
  items: ChartContextItem[];
  variant?: 'compact' | 'modal';
}) {
  if (items.length === 0) return null;

  const shell =
    variant === 'modal'
      ? 'border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm'
      : 'rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs';

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1.5 ${shell}`}
      role="group"
      aria-label="Thông tin tổng quan"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-wrap items-baseline gap-x-1"
        >
          <span className="shrink-0 text-slate-500">{item.label}</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
