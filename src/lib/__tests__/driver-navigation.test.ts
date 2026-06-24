import {
  buildNavigationUrl,
  getPreferredNavApp,
  setPreferredNavApp,
  isNavApp,
  NAV_APPS,
  DEFAULT_NAV_APP,
} from "@/lib/driver-navigation";

describe("buildNavigationUrl — coordinates", () => {
  const target = { lat: 37.7879, lng: -122.4502 };
  const ll = encodeURIComponent("37.7879,-122.4502");

  it("builds a Google Maps directions URL", () => {
    expect(buildNavigationUrl("google", target)).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    );
  });

  it("builds an Apple Maps driving URL", () => {
    expect(buildNavigationUrl("apple", target)).toBe(
      `https://maps.apple.com/?daddr=${ll}&dirflg=d`,
    );
  });

  it("builds a Waze URL that starts navigation", () => {
    expect(buildNavigationUrl("waze", target)).toBe(
      `https://waze.com/ul?ll=${ll}&navigate=yes`,
    );
  });

  it("returns null for non-finite coordinates", () => {
    expect(buildNavigationUrl("google", { lat: NaN, lng: 1 })).toBeNull();
  });
});

describe("buildNavigationUrl — address", () => {
  const target = { address: "390 Laurel St, San Francisco, CA" };
  const q = encodeURIComponent("390 Laurel St, San Francisco, CA");

  it("builds each app's URL from a free-text address", () => {
    expect(buildNavigationUrl("google", target)).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    );
    expect(buildNavigationUrl("apple", target)).toBe(
      `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    );
    expect(buildNavigationUrl("waze", target)).toBe(
      `https://waze.com/ul?q=${q}&navigate=yes`,
    );
  });

  it("returns null for a blank address", () => {
    expect(buildNavigationUrl("google", { address: "   " })).toBeNull();
  });
});

describe("navigation-app preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to Google when nothing is stored", () => {
    expect(getPreferredNavApp()).toBe(DEFAULT_NAV_APP);
    expect(DEFAULT_NAV_APP).toBe("google");
  });

  it("round-trips a stored choice", () => {
    setPreferredNavApp("waze");
    expect(getPreferredNavApp()).toBe("waze");
  });

  it("ignores an invalid stored value", () => {
    window.localStorage.setItem("rs:driverNavApp", "bogus");
    expect(getPreferredNavApp()).toBe("google");
  });

  it("guards values with isNavApp and exposes the three apps in order", () => {
    expect(isNavApp("waze")).toBe(true);
    expect(isNavApp("bogus")).toBe(false);
    expect(NAV_APPS.map((a) => a.id)).toEqual(["google", "apple", "waze"]);
  });
});
