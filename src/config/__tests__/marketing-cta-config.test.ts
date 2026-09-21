import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";

describe("isMarketingCtaEnabled", () => {
  it("keeps FLOWERS_ABOUT_SERVICE_WORKS disabled (intended 2026-08 state)", () => {
    expect(isMarketingCtaEnabled("FLOWERS_ABOUT_SERVICE_WORKS")).toBe(false);
  });
});
