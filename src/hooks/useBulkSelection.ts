import { useCallback, useMemo, useState } from "react";
import type { UseBulkSelectionReturn } from "@/types/bulk-operations";

/**
 * Hook for managing bulk selection state
 *
 * Provides O(1) lookups for selection state using a Set,
 * with utilities for toggling, selecting all, and clearing selections.
 *
 * @example
 * ```tsx
 * const {
 *   selectedIds,
 *   selectedCount,
 *   isAllOnPageSelected,
 *   toggle,
 *   selectAll,
 *   deselectAll,
 *   clearAll,
 *   isSelected,
 * } = useBulkSelection();
 *
 * // In a table row
 * <Checkbox
 *   checked={isSelected(user.id)}
 *   onCheckedChange={() => toggle(user.id)}
 * />
 *
 * // Header checkbox for select all on page
 * <Checkbox
 *   checked={isAllOnPageSelected}
 *   onCheckedChange={(checked) =>
 *     checked ? selectAll(userIds) : deselectAll(userIds)
 *   }
 * />
 * ```
 */
export function useBulkSelection(
  pageIds: string[] = []
): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /**
   * Toggle a single item's selection state
   */
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Select all provided IDs (additive - doesn't clear existing selections)
   */
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Deselect all provided IDs
   */
  const deselectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  /**
   * Clear all selections
   */
  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if an ID is selected (O(1) lookup)
   */
  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  /**
   * Count of selected items
   */
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  /**
   * Whether all items on the current page are selected
   */
  const isAllOnPageSelected = useMemo(() => {
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => selectedIds.has(id));
  }, [pageIds, selectedIds]);

  /**
   * Whether some (but not all) items on the current page are selected
   * Useful for indeterminate checkbox state
   */
  const isSomeOnPageSelected = useMemo(() => {
    if (pageIds.length === 0) return false;
    const selectedOnPage = pageIds.filter((id) => selectedIds.has(id));
    return selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
  }, [pageIds, selectedIds]);

  return {
    selectedIds,
    selectedCount,
    isAllOnPageSelected,
    toggle,
    selectAll,
    deselectAll,
    clearAll,
    isSelected,
  };
}

/**
 * Get selected IDs as an array
 * Utility function for when you need to pass IDs to an API
 */
export function getSelectedIdsArray(selectedIds: Set<string>): string[] {
  return Array.from(selectedIds);
}
