import {
  getOrderNotificationConfig,
  DEFAULT_ORDER_NOTIFICATION_RECIPIENTS,
} from "@/config/order-notifications";

describe("getOrderNotificationConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset relevant env vars before each test
    delete process.env.ORDER_NOTIFICATION_RECIPIENTS;
    delete process.env.ORDER_NOTIFICATIONS_ENABLED;
    delete process.env.ADMIN_EMAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Default recipients
  // -----------------------------------------------------------------------

  it("defaults to the full recipient list in production with no env var set", () => {
    process.env.NODE_ENV = "production";
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
  // Fan-out guard (non-production)
  // -----------------------------------------------------------------------

  it("returns empty recipients and enabled=false in non-production without ORDER_NOTIFICATION_RECIPIENTS", () => {
    process.env.NODE_ENV = "development";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
  });

  it("returns empty recipients and enabled=false in test without ORDER_NOTIFICATION_RECIPIENTS", () => {
    process.env.NODE_ENV = "test";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([]);
    expect(config.enabled).toBe(false);
  });

  it("allows non-production when ORDER_NOTIFICATION_RECIPIENTS is set", () => {
    process.env.NODE_ENV = "development";
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "dev@example.com";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual(["dev@example.com"]);
    expect(config.enabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ADMIN_EMAIL does NOT shadow the default list
  // -----------------------------------------------------------------------

  it("ignores ADMIN_EMAIL — it does not shadow the default recipient list", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_EMAIL = "single@example.com";
    const config = getOrderNotificationConfig();
    // Must be the full default list, NOT the single ADMIN_EMAIL address
    expect(config.recipients).toEqual([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]);
    expect(config.recipients).not.toContain("single@example.com");
  });

  // -----------------------------------------------------------------------
  // Parsing & whitespace trimming
  // -----------------------------------------------------------------------

  it("parses a comma-separated list and trims whitespace", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDER_NOTIFICATION_RECIPIENTS =
      " a@example.com , b@example.com , c@example.com ";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
  });

  // -----------------------------------------------------------------------
  // Malformed entries
  // -----------------------------------------------------------------------

  it("discards malformed entries and keeps valid ones", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDER_NOTIFICATION_RECIPIENTS =
      "good@example.com,not-an-email,also@valid.org,@broken";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual(["good@example.com", "also@valid.org"]);
  });

  it("falls back to the full default list when every entry is invalid", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDER_NOTIFICATION_RECIPIENTS = "garbage,not-an-email,@nope";
    const config = getOrderNotificationConfig();
    expect(config.recipients).toEqual([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]);
    expect(config.enabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Kill switch
  // -----------------------------------------------------------------------

  it("disables when ORDER_NOTIFICATIONS_ENABLED=false", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDER_NOTIFICATIONS_ENABLED = "false";
    const config = getOrderNotificationConfig();
    expect(config.enabled).toBe(false);
    // Recipients are still resolved — only the flag changes
    expect(config.recipients).toEqual([...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS]);
  });

  it("stays enabled for any value other than 'false'", () => {
    process.env.NODE_ENV = "production";
    process.env.ORDER_NOTIFICATIONS_ENABLED = "true";
    expect(getOrderNotificationConfig().enabled).toBe(true);

    process.env.ORDER_NOTIFICATIONS_ENABLED = "1";
    expect(getOrderNotificationConfig().enabled).toBe(true);

    delete process.env.ORDER_NOTIFICATIONS_ENABLED;
    expect(getOrderNotificationConfig().enabled).toBe(true);
  });
});
