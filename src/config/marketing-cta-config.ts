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
   * "How Our Service Works" pill in `FlowersAbout`, under the florist photo
   * on /flowers-deliveries. Links to /vendor-hero.
   * Disabled 2026-08 — duplicated the CTA already present in ServiceFeaturesSection.
   */
  FLOWERS_ABOUT_SERVICE_WORKS: false,

  /**
   * "Get Started" ScheduleDialog trigger in `CateringFeatures`, under the three
   * feature cards on /catering-deliveries. Opens the Google Calendar booking flow.
   * Disabled 2026-08 — CateringAbout already carries a CTA on the same page.
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
