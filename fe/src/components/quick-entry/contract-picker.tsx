'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { contractsApi, projectsApi } from '@/lib/api';
import type { Contract, Project } from '@/lib/types';
import { contractKindLabel } from '@/lib/contract-kind';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'quick-entry-contract-id';

export function readStoredContractId(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

export function storeContractId(id: string) {
  if (typeof window === 'undefined') return;
  if (id) sessionStorage.setItem(STORAGE_KEY, id);
  else sessionStorage.removeItem(STORAGE_KEY);
}

type ProjectOption = Pick<Project, 'id' | 'code' | 'name'>;

const projectLabel = (p: ProjectOption) => `${p.code} — ${p.name}`;
const contractLabel = (c: Contract) => `${c.contractNo} — ${c.name}`;

/**
 * Chọn dự án trước → ô hợp đồng tự mở danh sách HĐ của dự án đó (CĐT, thầu phụ, NCC).
 * Dự án chỉ có 1 HĐ thì chọn luôn.
 */
export function ContractPicker({
  value,
  onChange,
  onContractLoaded,
}: {
  value: string;
  onChange: (contractId: string) => void;
  onContractLoaded?: (contract: Contract | null) => void;
}) {
  const [project, setProject] = useState<ProjectOption | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [contractOpenSignal, setContractOpenSignal] = useState(0);

  // HĐ đang chọn (từ URL / phiên trước) → điền luôn dự án của HĐ
  useEffect(() => {
    if (!value) {
      onContractLoaded?.(null);
      return;
    }
    let cancelled = false;
    contractsApi
      .get(value)
      .then((c) => {
        if (cancelled) return;
        setContract(c);
        if (c.project) setProject(c.project);
        onContractLoaded?.(c);
      })
      .catch(() => {
        if (!cancelled) onContractLoaded?.(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, onContractLoaded]);

  const pickContract = (c: Contract | null) => {
    setContract(c);
    storeContractId(c?.id ?? '');
    onChange(c?.id ?? '');
  };

  const pickProject = async (p: ProjectOption | null) => {
    setProject(p);
    pickContract(null);
    if (!p) return;
    const res = await contractsApi
      .list({ projectId: p.id, kind: 'ALL', limit: 2 })
      .catch(() => null);
    if (res?.data.length === 1) pickContract(res.data[0]);
    else setContractOpenSignal((n) => n + 1);
  };

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-1">
        <Label className="text-xs">1. Dự án</Label>
        <SearchCombobox<ProjectOption>
          selected={project}
          getKey={(p) => p.id}
          getLabel={projectLabel}
          placeholder="Tìm dự án: mã, tên…"
          fetchOptions={(search) =>
            projectsApi
              .list({
                search: search || undefined,
                limit: 50,
                sortBy: 'code',
                sortOrder: 'asc',
              })
              .then((res) => res.data)
          }
          onPick={(p) => void pickProject(p)}
          renderOption={(p) => (
            <>
              <span className="font-mono text-xs font-semibold text-slate-900">
                {p.code}
              </span>
              <p className="truncate text-slate-600">{p.name}</p>
            </>
          )}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">2. Hợp đồng</Label>
        <SearchCombobox<Contract>
          selected={contract}
          getKey={(c) => c.id}
          getLabel={contractLabel}
          disabled={!project}
          placeholder={
            project ? 'Tìm hợp đồng: số HĐ, tên…' : 'Chọn dự án trước'
          }
          optionsKey={project?.id ?? ''}
          openSignal={contractOpenSignal}
          fetchOptions={(search) =>
            contractsApi
              .list({
                projectId: project?.id,
                search: search || undefined,
                kind: 'ALL',
                limit: 100,
                sortBy: 'contractNo',
                sortOrder: 'asc',
              })
              .then((res) => res.data)
          }
          onPick={pickContract}
          emptyText="Dự án chưa có hợp đồng phù hợp."
          renderOption={(c) => (
            <>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">
                  {c.contractNo}
                </span>
                {c.kind && c.kind !== 'INVESTOR' ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {contractKindLabel[c.kind]}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-slate-600">{c.name}</p>
            </>
          )}
        />
      </div>
    </div>
  );
}

/** Ô tìm kiếm: bấm / gõ là hiện danh sách để chọn ngay (↑ ↓ Enter, Esc) */
function SearchCombobox<T>({
  selected,
  getKey,
  getLabel,
  fetchOptions,
  onPick,
  renderOption,
  placeholder,
  disabled = false,
  optionsKey = '',
  openSignal = 0,
  emptyText = 'Không tìm thấy.',
}: {
  selected: T | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  fetchOptions: (search: string) => Promise<T[]>;
  onPick: (item: T | null) => void;
  renderOption: (item: T) => ReactNode;
  placeholder: string;
  disabled?: boolean;
  /** Đổi giá trị → tải lại danh sách (vd. đổi dự án) */
  optionsKey?: string;
  /** Tăng lên → mở danh sách + focus ô */
  openSignal?: number;
  emptyText?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const fetchRef = useRef(fetchOptions);
  useEffect(() => {
    fetchRef.current = fetchOptions;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      fetchRef
        .current(search.trim())
        .then((rows) => {
          if (cancelled) return;
          setOptions(rows);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, open, optionsKey]);

  useEffect(() => {
    if (openSignal === 0) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (item: T | null) => {
    setSearch('');
    setOpen(false);
    onPick(item);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Đang gõ → hiện từ khóa; không gõ → hiện mục đã chọn
  const inputValue = open || !selected ? search : getLabel(selected);
  const selectedKey = selected ? getKey(selected) : '';

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        ref={inputRef}
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={selected ? getLabel(selected) : placeholder}
        className={cn(
          'h-11 pl-9 pr-9 text-sm',
          selected && !open && 'font-medium text-slate-900',
        )}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {selected && !disabled ? (
        <button
          type="button"
          onClick={() => {
            pick(null);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Bỏ chọn"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && !disabled ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading && options.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tìm…
            </li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li>
          ) : (
            options.map((item, index) => (
              <li
                key={getKey(item)}
                data-index={index}
                role="option"
                aria-selected={getKey(item) === selectedKey}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm',
                  index === active && 'bg-slate-100',
                  getKey(item) === selectedKey && 'font-semibold',
                )}
              >
                {renderOption(item)}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
