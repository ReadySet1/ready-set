// src/__tests__/api/job-applications/submit.test.ts

import { POST } from "@/app/api/job-applications/route";
import { prisma } from "@/utils/prismaDB";
import { createAdminClient, createClient } from "@/utils/supabase/server";

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    fileUpload: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    jobApplication: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock("@/utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/job-application-email", () => ({
  buildJobApplicationEmailHtml: jest.fn().mockReturnValue("<p>email</p>"),
}));

const SESSION_ID = "11111111-2222-3333-4444-555555555555";
const TOKEN = "f".repeat(64);

function buildRequest(body: Record<string, unknown>, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-upload-token"] = token;
  return new Request("http://localhost/api/job-applications", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const baseBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  role: "Server",
  skills: [],
};

describe("POST /api/job-applications - upload ownership", () => {
  let single: jest.Mock;
  let adminClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    single = jest.fn();
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    adminClient = {
      from: jest.fn().mockReturnValue({ select }),
      storage: {
        from: jest.fn().mockReturnValue({
          move: jest.fn().mockResolvedValue({ data: {}, error: null }),
          createSignedUrl: jest
            .fn()
            .mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "" } }),
        }),
      },
    };
    (createAdminClient as jest.Mock).mockResolvedValue(adminClient);
    (createClient as jest.Mock).mockResolvedValue({});
    (prisma.jobApplication.create as jest.Mock).mockResolvedValue({
      id: "app-1",
      firstName: "Ada",
      lastName: "Lovelace",
      position: "Server",
    });
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      fileUploads: [],
    });
  });

  it("still accepts an application without uploads and without a token", async () => {
    const response = await POST(buildRequest(baseBody));

    expect(response.status).toBe(200);
    expect(prisma.jobApplication.create).toHaveBeenCalled();
    expect(prisma.fileUpload.findMany).not.toHaveBeenCalled();
  });

  it("rejects file IDs without an upload token and creates nothing", async () => {
    const response = await POST(
      buildRequest({ ...baseBody, resumeFileId: "victim-file" }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/upload session is missing or expired/i);
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    expect(prisma.fileUpload.update).not.toHaveBeenCalled();
    expect(adminClient.storage.from).not.toHaveBeenCalled();
  });

  it("rejects a file that is not in the caller's session folder and creates nothing", async () => {
    single.mockResolvedValue({
      data: {
        id: SESSION_ID,
        session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        completed: false,
      },
      error: null,
    });
    (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

    const response = await POST(
      buildRequest({ ...baseBody, driversLicenseFileId: "victim-file" }, TOKEN),
    );

    expect(response.status).toBe(400);
    expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["victim-file"] },
        jobApplicationId: null,
        filePath: { startsWith: `job-applications/temp/${SESSION_ID}/` },
      },
    });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    expect(adminClient.storage.from).not.toHaveBeenCalled();
  });

  it("links files that belong to the caller's session", async () => {
    single.mockResolvedValue({
      data: {
        id: SESSION_ID,
        session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        completed: false,
      },
      error: null,
    });
    const ownPath = `job-applications/temp/${SESSION_ID}/resume.pdf`;
    (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([
      {
        id: "own-file",
        fileName: "resume.pdf",
        fileUrl: `https://x.supabase.co/storage/v1/object/public/user-assets/${ownPath}`,
        filePath: ownPath,
        jobApplicationId: null,
        category: "resume",
      },
    ]);

    const response = await POST(
      buildRequest({ ...baseBody, resumeFileId: "own-file" }, TOKEN),
    );

    expect(response.status).toBe(200);
    expect(prisma.jobApplication.create).toHaveBeenCalled();
    expect(prisma.fileUpload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "own-file" },
        data: expect.objectContaining({ jobApplicationId: "app-1" }),
      }),
    );
  });
});
