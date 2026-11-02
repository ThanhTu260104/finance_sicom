'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export function useTableSelection(items: Array<{ id: string }>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(items.map((i) => i.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const someSelected = useMemo(
    () => items.some((i) => selectedIds.has(i.id)) && !allSelected,
    [items, selectedIds, allSelected],
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(items.map((i) => i.id)));
    },
    [items],
  );

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    allSelected,
    someSelected,
    toggleAll,
    toggleOne,
    clearSelection,
  };
}
