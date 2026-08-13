/**
 * Marketing CTA Visibility
 *
 * Build-time, site-wide visibility switches for call-to-action buttons on the public
 * marketing pages. One answer for every visitor — no per-user rollout, no runtime
 * evaluation. For gradual/percentage rollout of application features, use
 * `src/lib/feature-flags.ts` instead.
 *
 * To restore a button: flip its value to `true` and ship. Nothing else to change.
 */

export const MARKETING_CTA_FLAGS = {
  /**
   * FLOWERS_ABOUT_SERVICE_WORKS
   * Controls the "How Our Service Works" link in FlowersAbout (/flowers-deliveries).
   *
   * Disabled 2026-08 as a marketing decision — NOT because it was a duplicate.
   * The "Get Started" CTA in ServiceFeaturesSection opens the quote form: a
   * different action to a different destination.
   *
   * Known trade-off: this was the only link to /vendor-hero on the flowers page.
   * Site-wide, only FlowersAbout and CateringAbout link to that route, so while
   * this flag is false /vendor-hero loses a discovery path from here. Mitigated
   * by adding /vendor-hero to src/app/sitemap.ts (see Fix 3).
   */
  FLOWERS_ABOUT_SERVICE_WORKS: false,

  /**
   * CATERING_FEATURES_GET_STARTED
   * Controls the "Get Started" ScheduleDialog trigger in CateringFeatures
   * (/catering-deliveries). Opens the Google Calendar booking flow.
   *
   * Disabled 2026-08 as a marketing decision — NOT because it was a duplicate.
   *
   * Safe to hide because the booking path on this page is unaffected:
   * FoodHeader, CateringStats and CateringContact each keep their own
   * ScheduleDialog trigger.
   */
  CATERING_FEATURES_GET_STARTED: false,
} as const;

export type MarketingCtaFlag = keyof typeof MARKETING_CTA_FLAGS;

/**
 * Read a CTA visibility flag.
 *
 * Declared to return `boolean` rather than the literal type, so consumers do not get
 * spurious "this condition is always false" narrowing from the `as const` object.
 */
export function isMarketingCtaEnabled(flag: MarketingCtaFlag): boolean {
  return MARKETING_CTA_FLAGS[flag];
}
