import type { ProfileCounties } from "@/types/user";

/** Strips the doubled quotes some legacy CSV imports left around the value. */
const LEGACY_QUOTE_WRAP = /^""|""$/g;

/**
 * Normalizes the `profiles.counties` Json column into a `string[]`.
 *
 * Every writer in the app stores a comma-separated string
 * (`"Alameda, Contra Costa"`); older rows may hold a JSON array of strings.
 * Anything else is treated as "no counties" rather than guessed at.
 */
export function parseProfileCounties(value: ProfileCounties | unknown): string[] {
  if (typeof value === "string") {
    return cleanEntries(value.replace(LEGACY_QUOTE_WRAP, "").split(","));
  }
  if (Array.isArray(value)) {
    return cleanEntries(value.filter((entry): entry is string => typeof entry === "string"));
  }
  return [];
}

function cleanEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.trim()).filter((entry) => entry !== "");
}
