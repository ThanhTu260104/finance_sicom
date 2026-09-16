export default function ProjectsLoading() {
  return (
    <div className="space-y-4" aria-label="Đang tải danh sách dự án">
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-12 animate-pulse border-b border-slate-200 bg-slate-100" />
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid h-14 grid-cols-5 gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
            {[1, 2, 3, 4, 5].map((cell) => (
              <div key={cell} className="animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
