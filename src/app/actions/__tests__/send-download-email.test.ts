/**
 * Resource download email (forms QA C15).
 *
 * `/free-resources/<slug>` guides come from Sanity and are not in the static
 * resource list, so resolving only against that list silently dropped the
 * email for every Sanity guide.
 */

const send = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));
jest.mock("@/components/Resources/DownloadEmailTemplate", () => ({
  DownloadEmailTemplate: jest.fn(() => null),
}));

const getGuideBySlug = jest.fn();
jest.mock("@/sanity/lib/queries", () => ({
  getGuideBySlug: (slug: string) => getGuideBySlug(slug),
}));

import { resolveDownloadResource, sendDownloadEmail } from "../send-download-email";
import { resources } from "@/components/Resources/Data/Resources";
import { generateSlug } from "@/lib/create-slug";
import { DownloadEmailTemplate } from "@/components/Resources/DownloadEmailTemplate";

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

const sanityGuide = {
  title: "Catering Delivery Checklist",
  slug: { current: "catering-delivery-checklist" },
  downloadableFiles: [
    { _key: "k1", asset: { _id: "f1", url: "https://cdn.sanity.io/files/x/checklist.pdf", originalFilename: "checklist.pdf" } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  getGuideBySlug.mockResolvedValue(null);
});

afterAll(() => {
  process.env.RESEND_API_KEY = ORIGINAL_KEY;
});

describe("resolveDownloadResource", () => {
  it("resolves a static resource by its title slug", async () => {
    const staticResource = resources.find((r) => r.downloadUrl)!;

    await expect(resolveDownloadResource(generateSlug(staticResource.title))).resolves.toEqual({
      title: staticResource.title,
      downloadUrl: staticResource.downloadUrl,
    });
    expect(getGuideBySlug).not.toHaveBeenCalled();
  });

  it("falls back to the Sanity guide's first file", async () => {
    getGuideBySlug.mockResolvedValue(sanityGuide);

    await expect(resolveDownloadResource("catering-delivery-checklist")).resolves.toEqual({
      title: "Catering Delivery Checklist",
      downloadUrl: "https://cdn.sanity.io/files/x/checklist.pdf",
    });
  });

  it("returns null when neither source has a downloadable file", async () => {
    getGuideBySlug.mockResolvedValue({ ...sanityGuide, downloadableFiles: [] });

    await expect(resolveDownloadResource("catering-delivery-checklist")).resolves.toBeNull();
  });
});

describe("sendDownloadEmail", () => {
  it("emails the Sanity file for a Sanity-only guide", async () => {
    getGuideBySlug.mockResolvedValue(sanityGuide);

    await expect(
      sendDownloadEmail("lead@example.com", "Ana", "catering-delivery-checklist"),
    ).resolves.toBe(true);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["lead@example.com"] }));
    expect(DownloadEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceTitle: "Catering Delivery Checklist",
        downloadUrl: "https://cdn.sanity.io/files/x/checklist.pdf",
      }),
    );
  });

  it("rejects an unknown slug without sending", async () => {
    await expect(sendDownloadEmail("lead@example.com", "Ana", "nope")).rejects.toThrow(
      "Resource not found",
    );
    expect(send).not.toHaveBeenCalled();
  });
});
