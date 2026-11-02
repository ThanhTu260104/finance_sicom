'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export function ContractContextBar({
  projectCode,
  projectName,
  projectId,
  contractNo,
  contractName,
  className,
}: {
  projectCode?: string | null;
  projectName?: string | null;
  projectId?: string | null;
  contractNo: string;
  contractName: string;
  className?: string;
}) {
  const projectPart =
    projectCode && projectName
      ? projectId
        ? (
            <Link
              href={`/projects/${projectId}`}
              className="font-medium text-slate-900 underline-offset-2 hover:underline"
            >
              {projectName}
            </Link>
          )
        : (
            <span className="font-medium text-slate-900">{projectName}</span>
          )
      : projectCode
        ? (
            <span className="font-medium text-slate-900">{projectCode}</span>
          )
        : null;

  return (
    <div
      className={cn(
        'sticky top-0 z-30 border-b border-slate-200 bg-white/95 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90',
        className,
      )}
    >
      <p className="truncate text-sm text-slate-800">
        {projectPart ? (
          <>
            {projectPart}
            <span className="mx-2 text-slate-400" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span className="font-mono font-semibold text-slate-900">{contractNo}</span>
        <span className="mx-2 text-slate-400" aria-hidden>
          ·
        </span>
        <span className="font-medium text-slate-800">{contractName}</span>
      </p>
    </div>
  );
}
