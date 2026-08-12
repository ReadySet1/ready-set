import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";

describe("isMarketingCtaEnabled", () => {
  it("keeps both marketing CTAs disabled (intended 2026-08 state)", () => {
    expect(isMarketingCtaEnabled("FLOWERS_ABOUT_SERVICE_WORKS")).toBe(false);
    expect(isMarketingCtaEnabled("CATERING_FEATURES_GET_STARTED")).toBe(false);
  });
});
