import { renderHook, act } from "@testing-library/react";
import { useBulkSelection, getSelectedIdsArray } from "../useBulkSelection";

describe("useBulkSelection", () => {
  describe("initialization", () => {
    it("should initialize with empty selection", () => {
      const { result } = renderHook(() => useBulkSelection());
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllOnPageSelected).toBe(false);
    });

    it("should accept pageIds and track selection state", () => {
      const pageIds = ["user-1", "user-2", "user-3"];
      const { result } = renderHook(() => useBulkSelection(pageIds));
      expect(result.current.isAllOnPageSelected).toBe(false);
    });
  });

  describe("toggle", () => {
    it("should add an item when toggling an unselected item", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggle("user-1");
      });

      expect(result.current.selectedIds.has("user-1")).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });

    it("should remove an item when toggling a selected item", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggle("user-1");
        result.current.toggle("user-1");
      });

      expect(result.current.selectedIds.has("user-1")).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it("should handle multiple toggles", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggle("user-1");
        result.current.toggle("user-2");
        result.current.toggle("user-3");
      });

      expect(result.current.selectedCount).toBe(3);

      act(() => {
        result.current.toggle("user-2");
      });

      expect(result.current.selectedCount).toBe(2);
      expect(result.current.selectedIds.has("user-1")).toBe(true);
      expect(result.current.selectedIds.has("user-2")).toBe(false);
      expect(result.current.selectedIds.has("user-3")).toBe(true);
    });
  });

  describe("selectAll", () => {
    it("should select all provided IDs", () => {
      const { result } = renderHook(() => useBulkSelection());
      const ids = ["user-1", "user-2", "user-3"];

      act(() => {
        result.current.selectAll(ids);
      });

      expect(result.current.selectedCount).toBe(3);
      ids.forEach((id) => {
        expect(result.current.selectedIds.has(id)).toBe(true);
      });
    });

    it("should be additive - not clear existing selections", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggle("user-0");
        result.current.selectAll(["user-1", "user-2"]);
      });

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.selectedIds.has("user-0")).toBe(true);
    });
  });

  describe("deselectAll", () => {
    it("should deselect all provided IDs", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectAll(["user-1", "user-2", "user-3"]);
        result.current.deselectAll(["user-1", "user-2"]);
      });

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selectedIds.has("user-3")).toBe(true);
    });

    it("should not affect IDs not in selection", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectAll(["user-1", "user-2"]);
        result.current.deselectAll(["user-3", "user-4"]);
      });

      expect(result.current.selectedCount).toBe(2);
    });
  });

  describe("clearAll", () => {
    it("should clear all selections", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectAll(["user-1", "user-2", "user-3"]);
        result.current.clearAll();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe("isSelected", () => {
    it("should return true for selected items", () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggle("user-1");
      });

      expect(result.current.isSelected("user-1")).toBe(true);
    });

    it("should return false for unselected items", () => {
      const { result } = renderHook(() => useBulkSelection());

      expect(result.current.isSelected("user-1")).toBe(false);
    });
  });

  describe("isAllOnPageSelected", () => {
    it("should return false when page is empty", () => {
      const { result } = renderHook(() => useBulkSelection([]));
      expect(result.current.isAllOnPageSelected).toBe(false);
    });

    it("should return false when no items are selected", () => {
      const pageIds = ["user-1", "user-2", "user-3"];
      const { result } = renderHook(() => useBulkSelection(pageIds));
      expect(result.current.isAllOnPageSelected).toBe(false);
    });

    it("should return false when only some items are selected", () => {
      const pageIds = ["user-1", "user-2", "user-3"];
      const { result } = renderHook(() => useBulkSelection(pageIds));

      act(() => {
        result.current.toggle("user-1");
        result.current.toggle("user-2");
      });

      expect(result.current.isAllOnPageSelected).toBe(false);
    });

    it("should return true when all page items are selected", () => {
      const pageIds = ["user-1", "user-2", "user-3"];
      const { result } = renderHook(() => useBulkSelection(pageIds));

      act(() => {
        result.current.selectAll(pageIds);
      });

      expect(result.current.isAllOnPageSelected).toBe(true);
    });

    it("should return true when all page items plus others are selected", () => {
      const pageIds = ["user-1", "user-2", "user-3"];
      const { result } = renderHook(() => useBulkSelection(pageIds));

      act(() => {
        result.current.selectAll(["user-1", "user-2", "user-3", "user-4"]);
      });

      expect(result.current.isAllOnPageSelected).toBe(true);
    });

    it("should update when pageIds prop changes", () => {
      const { result, rerender } = renderHook(
        ({ pageIds }) => useBulkSelection(pageIds),
        { initialProps: { pageIds: ["user-1", "user-2"] } }
      );

      act(() => {
        result.current.selectAll(["user-1", "user-2"]);
      });

      expect(result.current.isAllOnPageSelected).toBe(true);

      // Change page to different users
      rerender({ pageIds: ["user-3", "user-4"] });

      expect(result.current.isAllOnPageSelected).toBe(false);
    });
  });

  describe("getSelectedIdsArray utility", () => {
    it("should convert Set to array", () => {
      const set = new Set(["user-1", "user-2", "user-3"]);
      const array = getSelectedIdsArray(set);

      expect(Array.isArray(array)).toBe(true);
      expect(array.length).toBe(3);
      expect(array).toContain("user-1");
      expect(array).toContain("user-2");
      expect(array).toContain("user-3");
    });

    it("should return empty array for empty Set", () => {
      const set = new Set<string>();
      const array = getSelectedIdsArray(set);

      expect(array).toEqual([]);
    });
  });

  describe("performance", () => {
    it("should handle large selections efficiently", () => {
      const { result } = renderHook(() => useBulkSelection());
      const ids = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

      const start = performance.now();

      act(() => {
        result.current.selectAll(ids);
      });

      const elapsed = performance.now() - start;

      expect(result.current.selectedCount).toBe(1000);
      expect(elapsed).toBeLessThan(100); // Should complete in under 100ms
    });

    it("should have O(1) lookup for isSelected", () => {
      const { result } = renderHook(() => useBulkSelection());
      const ids = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

      act(() => {
        result.current.selectAll(ids);
      });

      const start = performance.now();

      // Check multiple lookups
      for (let i = 0; i < 1000; i++) {
        result.current.isSelected(`user-${i}`);
      }

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50); // Should complete in under 50ms
    });
  });
});
