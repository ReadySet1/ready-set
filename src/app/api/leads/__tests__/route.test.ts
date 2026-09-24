import { NextRequest } from "next/server";

jest.mock("@/utils/prismaDB", () => ({
  prisma: { leadCapture: { upsert: jest.fn().mockResolvedValue({ id: "lead-1" }) } },
}));

const sendDownloadEmail = jest.fn();
jest.mock("@/app/actions/send-download-email", () => ({
  sendDownloadEmail: (...args: unknown[]) => sendDownloadEmail(...args),
}));

import { POST } from "../route";

const ORIGINAL_SENDGRID = process.env.SENDGRID_API_KEY;

function leadRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Ana",
      lastName: "Lopez",
      email: "lead@example.com",
      industry: "Catering",
      newsletterConsent: false,
      ...body,
    }),
  });
}

beforeAll(() => {
  delete process.env.SENDGRID_API_KEY;
});

afterAll(() => {
  process.env.SENDGRID_API_KEY = ORIGINAL_SENDGRID;
});

beforeEach(() => jest.clearAllMocks());

describe("POST /api/leads download email", () => {
  it("reports emailSent: true when the resource email goes out", async () => {
    sendDownloadEmail.mockResolvedValue(true);

    const res = await POST(leadRequest({ resourceSlug: "guide" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, emailSent: true });
  });

  it("still saves the lead but reports emailSent: false when the email fails", async () => {
    sendDownloadEmail.mockRejectedValue(new Error("Resource not found: guide"));

    const res = await POST(leadRequest({ resourceSlug: "guide" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, emailSent: false });
  });

  it("omits emailSent when no resource email was requested", async () => {
    const res = await POST(leadRequest({}));

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty("emailSent");
    expect(sendDownloadEmail).not.toHaveBeenCalled();
  });
});
