/**
 * Simulate a browser in a given IANA timezone.
 *
 * Every Date#toLocale*String call defaults to `timeZone` unless the caller passes
 * its own, so a component that leaks the browser timezone renders differently
 * from one pinned to the app timezone, deterministically on any machine (CI runs
 * in UTC, devs anywhere). Undo with `jest.restoreAllMocks()` in `afterEach`.
 */

type LocaleMethod = "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString";

const LOCALE_METHODS: LocaleMethod[] = [
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
];

// Captured once so that repeated installs never wrap an earlier spy.
const originals = Object.fromEntries(
  LOCALE_METHODS.map((m) => [m, Date.prototype[m]]),
) as Record<
  LocaleMethod,
  (this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) => string
>;

export function simulateBrowserTimezone(timeZone: string): void {
  for (const method of LOCALE_METHODS) {
    jest
      .spyOn(Date.prototype, method)
      .mockImplementation(function (
        this: Date,
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        return originals[method].call(this, locales, { timeZone, ...options });
      });
  }
}
