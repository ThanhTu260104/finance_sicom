'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ColumnDef<K extends string = string> = {
  key: K;
  label: string;
  /** Always visible; cannot be hidden */
  locked?: boolean;
  /** Default visibility when no saved preference */
  defaultVisible?: boolean;
};

export function useColumnVisibility<K extends string>(
  storageKey: string,
  columns: Array<ColumnDef<K>>,
) {
  const defaultVisible = useMemo(() => {
    const set = new Set<K>();
    for (const col of columns) {
      if (col.locked || col.defaultVisible !== false) set.add(col.key);
    }
    return set;
  }, [columns]);

  const [visible, setVisible] = useState<Set<K>>(defaultVisible);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setVisible(defaultVisible);
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      const next = new Set<K>();
      for (const col of columns) {
        if (col.locked) next.add(col.key);
        else if (parsed.includes(col.key)) next.add(col.key);
      }
      // Ensure at least one non-action column if all hidden
      if (next.size === 0) {
        setVisible(defaultVisible);
        return;
      }
      setVisible(next);
    } catch {
      setVisible(defaultVisible);
    }
  }, [storageKey, columns, defaultVisible]);

  const persist = useCallback(
    (next: Set<K>) => {
      setVisible(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const isVisible = useCallback((key: K) => visible.has(key), [visible]);

  const toggle = useCallback(
    (key: K, checked: boolean) => {
      const col = columns.find((c) => c.key === key);
      if (!col || col.locked) return;
      const next = new Set(visible);
      if (checked) next.add(key);
      else next.delete(key);
      if (next.size === 0) return;
      persist(next);
    },
    [columns, persist, visible],
  );

  const showAll = useCallback(() => {
    persist(new Set(columns.map((c) => c.key)));
  }, [columns, persist]);

  const reset = useCallback(() => {
    persist(new Set(defaultVisible));
  }, [defaultVisible, persist]);

  return { isVisible, toggle, showAll, reset, visible };
}
