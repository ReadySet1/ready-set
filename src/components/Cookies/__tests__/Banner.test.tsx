import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import CookieConsentBanner from "../Banner";

// Mock the third-party analytics components so we can assert on their *mount*
jest.mock("@next/third-parties/google", () => ({
  __esModule: true,
  GoogleAnalytics: ({ gaId }: { gaId: string }) => (
    <div data-testid="ga-mount" data-ga-id={gaId} />
  ),
}));

jest.mock("@/components/Analytics/MetriCool", () => ({
  __esModule: true,
  default: ({ trackingHash }: { trackingHash: string }) => (
    <div data-testid="metricool-mount" data-hash={trackingHash} />
  ),
}));

jest.mock("../CookiePreferencesModal", () => ({
  __esModule: true,
  default: () => null,
}));

const GA_ID = "G-TEST123";
const METRICOOL_HASH = "hash-abc";

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.trim().replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;");
    });
    delete (window as Record<string, unknown>)[`ga-disable-${GA_ID}`];
  });

  it("does not mount GA or Metricool on first paint when no consent stored", () => {
    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);
    expect(screen.queryByTestId("ga-mount")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metricool-mount")).not.toBeInTheDocument();
  });

  it("sets ga-disable flag pre-emptively when no consent stored", () => {
    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);
    expect((window as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true);
  });

  it("shows the banner when no consent is stored", () => {
    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);
    expect(screen.getByTestId("cookie-accept-all")).toBeInTheDocument();
    expect(screen.getByTestId("cookie-reject-all")).toBeInTheDocument();
  });

  it("mounts GA + Metricool after Accept All", async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);

    await user.click(screen.getByTestId("cookie-accept-all"));

    expect(screen.getByTestId("ga-mount")).toBeInTheDocument();
    expect(screen.getByTestId("metricool-mount")).toBeInTheDocument();
    expect((window as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(false);
    expect(localStorage.getItem("cookieConsentStatus")).toBe("accepted");
  });

  it("does NOT mount GA after Reject All and clears _ga* cookies", async () => {
    document.cookie = "_ga=GA1.1.test;path=/";
    document.cookie = "_gid=GA1.1.test;path=/";
    document.cookie = "_gat=1;path=/";

    const user = userEvent.setup();
    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);

    await user.click(screen.getByTestId("cookie-reject-all"));

    expect(screen.queryByTestId("ga-mount")).not.toBeInTheDocument();
    expect((window as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true);
    expect(localStorage.getItem("cookieConsentStatus")).toBe("rejected");
    expect(document.cookie).not.toMatch(/_ga=GA1\.1\.test/);
    expect(document.cookie).not.toMatch(/_gid=GA1\.1\.test/);
    expect(document.cookie).not.toMatch(/_gat=1/);
  });

  it("mounts GA on next render when consent already stored as accepted", () => {
    localStorage.setItem("cookieConsentStatus", "accepted");
    localStorage.setItem(
      "cookiePreferences",
      JSON.stringify({ necessary: true, analytics: true, marketing: true, personalization: true })
    );

    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);

    expect(screen.getByTestId("ga-mount")).toBeInTheDocument();
    expect(screen.getByTestId("metricool-mount")).toBeInTheDocument();
    // banner should not show
    expect(screen.queryByTestId("cookie-accept-all")).not.toBeInTheDocument();
  });

  it("does NOT mount GA when consent stored as rejected", () => {
    localStorage.setItem("cookieConsentStatus", "rejected");
    localStorage.setItem(
      "cookiePreferences",
      JSON.stringify({ necessary: true, analytics: false, marketing: false, personalization: false })
    );

    render(<CookieConsentBanner gaMeasurementId={GA_ID} metricoolHash={METRICOOL_HASH} />);

    expect(screen.queryByTestId("ga-mount")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metricool-mount")).not.toBeInTheDocument();
    expect((window as Record<string, unknown>)[`ga-disable-${GA_ID}`]).toBe(true);
  });
});
