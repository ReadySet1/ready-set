import { jobApplicationAdminUrl } from "../admin-links";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

describe("jobApplicationAdminUrl", () => {
  it("deep-links to the list page, which has no per-id route", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://dev.readysetllc.com/";

    expect(jobApplicationAdminUrl("app-1")).toBe(
      "https://dev.readysetllc.com/admin/job-applications?id=app-1",
    );
  });

  it("encodes the id", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://readysetllc.com";

    expect(jobApplicationAdminUrl("a b&c")).toBe(
      "https://readysetllc.com/admin/job-applications?id=a%20b%26c",
    );
  });
});
