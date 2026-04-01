import { useState, useCallback } from 'react';

export interface UseBulkSelectionOptions {
  items: any[];
  onSelectionChange?: (selected: string[]) => void;
}

export const useBulkSelection = (options: UseBulkSelectionOptions) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      options.onSelectionChange?.(Array.from(newSet));
      return newSet;
    });
  }, [options]);

  const toggleAll = useCallback(() => {
    if (selected.size === options.items.length && selected.size > 0) {
      setSelected(new Set());
      options.onSelectionChange?.([]);
    } else {
      const newSet = new Set(options.items.map((item) => item._id));
      setSelected(newSet);
      options.onSelectionChange?.(Array.from(newSet));
    }
  }, [options, selected.size]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    options.onSelectionChange?.([]);
  }, [options]);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const isAllSelected = useCallback(
    () => selected.size === options.items.length && selected.size > 0,
    [selected.size, options.items.length],
  );

  const isIndeterminate = useCallback(
    () => selected.size > 0 && selected.size < options.items.length,
    [selected.size, options.items.length],
  );

  return {
    selected: Array.from(selected),
    isSelected,
    toggleItem,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    count: selected.size,
  };
};
