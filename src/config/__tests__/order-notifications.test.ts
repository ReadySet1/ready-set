import {
  getOrderNotificationConfig,
  DEFAULT_ORDER_NOTIFICATION_RECIPIENTS,
} from "@/config/order-notifications";
import * as Sentry from "@sentry/nextjs";

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
}));

jest.mock("@/lib/monitoring/sentry-filters", () => ({
  getSentryEnvironment: jest.fn(() => process.env.__TEST_SENTRY_ENV ?? "test"),
}));

describe("getOrderNotificationConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ORDER_NOTIFICATION_RECIPIENTS;
    delete process.env.ORDER_NOTIFICATIONS_ENABLED;
    delete process.env.ADMIN_EMAIL;
    delete process.env.__TEST_SENTRY_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Kill switch beats everything
  // -----------------------------------------------------------------------

  it("returns disabled when ORDER_NOTIFICATIONS_ENABLED=false, even with valid recipients", () => {
    process.env.ORDER_NOTIFICATIONS_ENABLED = "false";
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "a@example.com";
    const config = getOrderNotificationConfig();
    expect(config).toEqual({ recipients: [], enabled: false });
  });

  it("returns disabled when ORDER_NOTIFICATIONS_ENABLED=false in production", () => {
    process.env.ORDER_NOTIFICATIONS_ENABLED = "false";
    process.env.__TEST_SENTRY_ENV = "production";
    const config = getOrderNotificationConfig();
    expect(config).toEqual({ recipients: [], enabled: false });
  });

  // -----------------------------------------------------------------------
  // Unset recipients + non-production → disabled (fail closed)
  // -----------------------------------------------------------------------

  it("returns disabled in non-production when ORDER_NOTIFICATION_RECIPIENTS is unset", () => {
    process.env.__TEST_SENTRY_ENV = "development";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
  });

  it("returns disabled in test environment without ORDER_NOTIFICATION_RECIPIENTS", () => {
    process.env.__TEST_SENTRY_ENV = "test";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Unset recipients + production → the two defaults
  // -----------------------------------------------------------------------

  it("defaults to the full recipient list in production with no env var set", () => {
    process.env.__TEST_SENTRY_ENV = "production";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]);
    expect(config.enabled).toBe(true);
  });

  it("pins the exact default addresses so a code change is a deliberate decision", () => {
    expect([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]).toEqual([
      "info@readysetllc.com",
      "austin@readysetllc.com",
    ]);
  });

  // -----------------------------------------------------------------------
  // Malformed list → disabled and Sentry called
  // -----------------------------------------------------------------------

  it("returns disabled and reports to Sentry when every entry is invalid", () => {
    process.env.__TEST_SENTRY_ENV = "production";
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "garbage,not-an-email,@nope";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "ORDER_NOTIFICATION_RECIPIENTS contains no valid addresses",
      { level: "error" },
    );
  });

  it("returns disabled and reports to Sentry for a single malformed address", () => {
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "me@localhost";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
    expect(Sentry.captureMessage).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Valid list → parsed
  // -----------------------------------------------------------------------

  it("parses a comma-separated list and trims whitespace", () => {
    process.env.ORDER_NOTIFICATION_RECIPIENTS =
      " a@example.com , b@example.com , c@example.com ";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
    expect(config.enabled).toBe(true);
  });

  it("allows non-production when ORDER_NOTIFICATION_RECIPIENTS is set explicitly", () => {
    process.env.__TEST_SENTRY_ENV = "development";
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "dev@example.com";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual(["dev@example.com"]);
    expect(config.enabled).toBe(true);
  });

  it("discards malformed entries and keeps valid ones", () => {
    process.env.ORDER_NOTIFICATION_RECIPIENTS =
      "good@example.com,not-an-email,also@valid.org,@broken";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual(["good@example.com", "also@valid.org"]);
  });

  it("stays enabled for any value of ORDER_NOTIFICATIONS_ENABLED other than 'false'", () => {
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "a@example.com";

    process.env.ORDER_NOTIFICATIONS_ENABLED = "true";
    expect(getOrderNotificationConfig().enabled).toBe(true);

    process.env.ORDER_NOTIFICATIONS_ENABLED = "1";
    expect(getOrderNotificationConfig().enabled).toBe(true);

    delete process.env.ORDER_NOTIFICATIONS_ENABLED;
    expect(getOrderNotificationConfig().enabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ADMIN_EMAIL does NOT shadow the default list
  // -----------------------------------------------------------------------

  it("ignores ADMIN_EMAIL — it does not shadow the default recipient list", () => {
    process.env.__TEST_SENTRY_ENV = "production";
    process.env.ADMIN_EMAIL = "single@example.com";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]);
    expect(config.recipients).not.toContain("single@example.com");
  });
});
