import { act, renderHook } from "@testing-library/react";

// Mock the changelog data so the latest version is deterministic.
jest.mock("@/data/changelog.json", () => ({
  title: "What's New",
  subtitle: "sub",
  entries: [
    { version: "3.0.0", date: "2026-06-01", title: "t", summary: "s", changes: [] },
    { version: "2.0.0", date: "2026-05-01", title: "t", summary: "s", changes: [] },
  ],
}));

import { useWhatsNew } from "@/hooks/useWhatsNew";

const STORAGE_KEY = "rs:lastSeenChangelogVersion";

describe("useWhatsNew", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the latest version (newest-first entry)", () => {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.latestVersion).toBe("3.0.0");
  });

  it("shows unseen on empty localStorage (first visit / incognito)", () => {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasUnseen).toBe(true);
  });

  it("is seen when localStorage already matches the latest version", () => {
    window.localStorage.setItem(STORAGE_KEY, "3.0.0");
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasUnseen).toBe(false);
  });

  it("is unseen when a newer version shipped than what's stored", () => {
    window.localStorage.setItem(STORAGE_KEY, "2.0.0");
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasUnseen).toBe(true);
  });

  it("markSeen() persists the latest version and clears the badge", () => {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.hasUnseen).toBe(true);

    act(() => {
      result.current.markSeen();
    });

    expect(result.current.hasUnseen).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("3.0.0");
  });
});
