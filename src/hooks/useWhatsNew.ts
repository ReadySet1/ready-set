"use client";

import { useCallback, useEffect, useState } from "react";
import changelogData from "@/data/changelog.json";
import type { ChangelogData } from "@/types/changelog";

const STORAGE_KEY = "rs:lastSeenChangelogVersion";

const data = changelogData as ChangelogData;

/** Newest entry's version (entries are newest-first). */
function getLatestVersion(): string {
  return data.entries[0]?.version ?? "";
}

export interface UseWhatsNewResult {
  /** True when the newest version differs from the last seen value. */
  hasUnseen: boolean;
  /** Newest changelog version (empty string if no entries). */
  latestVersion: string;
  /** Persist the latest version as seen and clear the badge. */
  markSeen: () => void;
}

/**
 * Tracks whether the user has seen the newest changelog entry, using
 * localStorage (no API, no DB). Returns a badge flag plus a markSeen()
 * action. SSR-safe: starts as unseen=false until the client reads storage.
 */
export function useWhatsNew(): UseWhatsNewResult {
  const latestVersion = getLatestVersion();
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !latestVersion) return;
    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (e.g. privacy mode) — treat as unseen.
      lastSeen = null;
    }
    setHasUnseen(lastSeen !== latestVersion);
  }, [latestVersion]);

  const markSeen = useCallback(() => {
    if (typeof window === "undefined" || !latestVersion) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, latestVersion);
    } catch {
      // Ignore storage failures; the badge simply won't persist.
    }
    setHasUnseen(false);
  }, [latestVersion]);

  return { hasUnseen, latestVersion, markSeen };
}

export default useWhatsNew;
