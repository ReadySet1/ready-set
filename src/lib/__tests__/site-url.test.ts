import {
  allowedOrigins,
  normalizeOrigin,
  siteOrigin,
  siteUrl,
} from "../site-url";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function setSiteUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = value;
  }
}

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("normalizeOrigin", () => {
  it("strips a trailing slash", () => {
    expect(normalizeOrigin("https://readysetllc.com/")).toBe(
      "https://readysetllc.com",
    );
  });

  it("strips a path, query and hash", () => {
    expect(normalizeOrigin("https://readysetllc.com/some/path?a=1#x")).toBe(
      "https://readysetllc.com",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeOrigin("  https://readysetllc.com  ")).toBe(
      "https://readysetllc.com",
    );
  });

  it("assumes https when the scheme is missing", () => {
    expect(normalizeOrigin("readysetllc.com")).toBe("https://readysetllc.com");
  });

  it("preserves an explicit port", () => {
    expect(normalizeOrigin("http://localhost:3000/")).toBe(
      "http://localhost:3000",
    );
  });

  it("returns null for empty, blank and unusable values", () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
    expect(normalizeOrigin("http://")).toBeNull();
  });
});

describe("siteOrigin", () => {
  afterEach(() => {
    setSiteUrl(ORIGINAL_SITE_URL);
    setNodeEnv("test");
  });

  it("normalises a configured value that carries a trailing slash", () => {
    setSiteUrl("https://readysetllc.com/");
    expect(siteOrigin()).toBe("https://readysetllc.com");
  });

  it("keeps a configured www host as-is", () => {
    setSiteUrl("https://www.readysetllc.com");
    expect(siteOrigin()).toBe("https://www.readysetllc.com");
  });

  it("falls back to the production host when unset in production", () => {
    setSiteUrl(undefined);
    setNodeEnv("production");
    expect(siteOrigin()).toBe("https://readysetllc.com");
  });

  it("falls back to localhost when unset outside production", () => {
    setSiteUrl(undefined);
    setNodeEnv("development");
    expect(siteOrigin()).toBe("http://localhost:3000");
  });

  it("never returns a Vercel host", () => {
    setSiteUrl(undefined);
    setNodeEnv("production");
    expect(siteOrigin()).not.toContain("vercel.app");
  });
});

describe("siteUrl", () => {
  afterEach(() => {
    setSiteUrl(ORIGINAL_SITE_URL);
    setNodeEnv("test");
  });

  it("joins a path without doubling the slash", () => {
    setSiteUrl("https://readysetllc.com/");
    expect(siteUrl("/auth/callback")).toBe(
      "https://readysetllc.com/auth/callback",
    );
  });

  it("adds the leading slash when the caller omits it", () => {
    setSiteUrl("https://readysetllc.com");
    expect(siteUrl("auth/callback")).toBe(
      "https://readysetllc.com/auth/callback",
    );
  });

  it("never produces the literal string 'undefined' when the env is unset", () => {
    setSiteUrl(undefined);
    setNodeEnv("production");
    expect(siteUrl("/auth/callback")).not.toContain("undefined");
  });

  it("defaults to the origin root", () => {
    setSiteUrl("https://readysetllc.com");
    expect(siteUrl()).toBe("https://readysetllc.com/");
  });
});

describe("allowedOrigins", () => {
  afterEach(() => {
    setSiteUrl(ORIGINAL_SITE_URL);
    setNodeEnv("test");
  });

  it("accepts both the apex and the www host when configured with the apex", () => {
    setSiteUrl("https://readysetllc.com/");
    expect(allowedOrigins()).toEqual(
      expect.arrayContaining([
        "https://readysetllc.com",
        "https://www.readysetllc.com",
      ]),
    );
  });

  it("accepts both hosts when configured with www", () => {
    setSiteUrl("https://www.readysetllc.com");
    expect(allowedOrigins()).toEqual(
      expect.arrayContaining([
        "https://readysetllc.com",
        "https://www.readysetllc.com",
      ]),
    );
  });

  it("does not invent a www variant for a host that has no registrable pair", () => {
    setSiteUrl("http://localhost:3000");
    expect(allowedOrigins()).toEqual(["http://localhost:3000"]);
  });
});
