// src/__tests__/api/job-applications/submit.test.ts

import { POST } from "@/app/api/job-applications/route";
import { prisma } from "@/utils/prismaDB";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { sendEmail } from "@/utils/email";
import { runAfterResponse } from "@/lib/api/after-response";
import * as Sentry from "@sentry/nextjs";

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

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Collect deferred after-response work so tests decide when it runs.
let deferredWork: Array<() => Promise<unknown>> = [];
jest.mock("@/lib/api/after-response", () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    deferredWork.push(work);
  }),
}));

async function flushAfterResponse(): Promise<void> {
  const work = deferredWork;
  deferredWork = [];
  await Promise.all(work.map((fn) => fn()));
}

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
    deferredWork = [];
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

describe("POST /api/job-applications - driver document columns", () => {
  const DRIVER_ROLE = "Driver for Catering Deliveries";

  // Written out literally, not read from the config: renaming a label or
  // changing the required set must fail these tests on purpose.
  const REQUIRED_UPLOADS = [
    ["license", "driversLicenseFileId", "Driver's License", "license.pdf"],
    ["insurance", "insuranceFileId", "Insurance", "insurance.pdf"],
    ["second_id", "secondIdFileId", "Second Form of ID", "passport.pdf"],
    ["car_photo", "carPhotoFileId", "Vehicle Photo", "car.jpg"],
    ["catering_bags", "cateringBagsPhotoFileId", "Catering Bags Photo", "bags.jpg"],
    ["cart_dolly", "cartDollyPhotoFileId", "Cart/Dolly Photo", "cart.jpg"],
  ] as const;

  const ALL_REQUIRED_MISSING =
    "Missing required documents: Driver's License, Insurance, Second Form of ID, Vehicle Photo, Catering Bags Photo, Cart/Dolly Photo";

  /** Session uploads for every required document (minus `except`) and the ids the form sends. */
  function requiredUploads(except?: string) {
    const rows = REQUIRED_UPLOADS.filter(([key]) => key !== except);
    return {
      uploads: rows.map(([key, , , fileName]) =>
        ownUpload(`${key}-file`, `job-applications/temp/${key}`, fileName),
      ),
      fileIds: Object.fromEntries(rows.map(([key, field]) => [field, `${key}-file`])),
    };
  }

  // A driver submission whose required documents were all uploaded in the caller's session.
  const driverBody = { ...baseBody, role: DRIVER_ROLE, ...requiredUploads().fileIds };

  function ownUpload(id: string, category: string, fileName: string) {
    const filePath = `job-applications/temp/${SESSION_ID}/${fileName}`;
    return {
      id,
      fileName,
      fileUrl: `https://x.supabase.co/storage/v1/object/public/user-assets/${filePath}`,
      filePath,
      jobApplicationId: null,
      category,
    };
  }

  function columnsWritten(): Record<string, string> {
    const call = (prisma.jobApplication.update as jest.Mock).mock.calls[0];
    return call ? call[0].data : {};
  }

  beforeEach(() => {
    jest.clearAllMocks();
    deferredWork = [];
    const single = jest.fn().mockResolvedValue({
      data: {
        id: SESSION_ID,
        session_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        completed: false,
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    (createAdminClient as jest.Mock).mockResolvedValue({
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
    });
    (createClient as jest.Mock).mockResolvedValue({});
    (prisma.jobApplication.create as jest.Mock).mockResolvedValue({
      id: "app-1",
      firstName: "Ada",
      lastName: "Lovelace",
      position: DRIVER_ROLE,
    });
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      fileUploads: [],
    });
  });

  function mockOwnedUploads(uploads: ReturnType<typeof ownUpload>[]) {
    // Behave like the database: return only the rows whose ids were requested.
    (prisma.fileUpload.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        uploads.filter((upload) => where.id.in.includes(upload.id)),
    );
  }

  it("accepts a driver with the six required uploads and no optional ones, writing their columns", async () => {
    mockOwnedUploads(requiredUploads().uploads);

    const response = await POST(buildRequest(driverBody, TOKEN));

    expect(response.status).toBe(200);
    expect(columnsWritten()).toEqual({
      driversLicenseFilePath: expect.stringMatching(/^job-applications\/app-1\/license_\d+\.pdf$/),
      insuranceFilePath: expect.stringMatching(/^job-applications\/app-1\/insurance_\d+\.pdf$/),
      secondIdFilePath: expect.stringMatching(/^job-applications\/app-1\/passport_\d+\.pdf$/),
      carPhotoFilePath: expect.stringMatching(/^job-applications\/app-1\/car_\d+\.jpg$/),
      cateringBagsPhotoFilePath: expect.stringMatching(/^job-applications\/app-1\/bags_\d+\.jpg$/),
      cartDollyPhotoFilePath: expect.stringMatching(/^job-applications\/app-1\/cart_\d+\.jpg$/),
    });
  });

  it.each(REQUIRED_UPLOADS)("rejects a driver missing the %s upload", async (key, _field, label) => {
    const { uploads, fileIds } = requiredUploads(key);
    mockOwnedUploads(uploads);

    const response = await POST(buildRequest({ ...baseBody, role: DRIVER_ROLE, ...fileIds }, TOKEN));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `Missing required documents: ${label}`,
    });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  it("lists every required document, in order, when a driver uploads nothing", async () => {
    const response = await POST(buildRequest({ ...baseBody, role: DRIVER_ROLE }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: ALL_REQUIRED_MISSING });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  // File paths in the payload are client claims, not uploads: they satisfy nothing.
  it("rejects a driver who sends only file paths", async () => {
    const response = await POST(
      buildRequest({
        ...baseBody,
        role: DRIVER_ROLE,
        driversLicenseFilePath: "job-applications/temp/s/license.pdf",
        insuranceFilePath: "job-applications/temp/s/insurance.pdf",
        secondIdFilePath: "job-applications/temp/s/passport.pdf",
        carPhotoFilePath: "job-applications/temp/s/car.jpg",
        cateringBagsPhotoFilePath: "job-applications/temp/s/bags.jpg",
        cartDollyPhotoFilePath: "job-applications/temp/s/cart.jpg",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: ALL_REQUIRED_MISSING });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  // The upload's own category decides what it covers, not the payload field it arrives in.
  it("does not count an insurance upload sent as the driver's license", async () => {
    const { uploads, fileIds } = requiredUploads("license");
    mockOwnedUploads([
      ...uploads,
      ownUpload("fake-license", "job-applications/temp/insurance", "license.pdf"),
    ]);

    const response = await POST(
      buildRequest(
        { ...baseBody, role: DRIVER_ROLE, ...fileIds, driversLicenseFileId: "fake-license" },
        TOKEN,
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing required documents: Driver's License",
    });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  // A missing session is reported before missing documents: reloading fixes the session first.
  it("rejects a driver's file ids without an upload token before checking documents", async () => {
    const response = await POST(buildRequest(driverBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringMatching(/upload session is missing or expired/i),
    });
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });

  // Regression guard for the findDocumentByCategory mapping in route.ts: every
  // category the old switch mapped, in both the bare and the temp-prefixed form,
  // keeps its column.
  // Uses a non-driver role so the required-documents check does not apply.
  describe.each(["", "job-applications/temp/"])("existing categories (prefix %p)", (prefix) => {
    it.each([
      ["resume", "resumeFileId", "resumeFilePath"],
      ["license", "driversLicenseFileId", "driversLicenseFilePath"],
      ["insurance", "insuranceFileId", "insuranceFilePath"],
      ["registration", "vehicleRegFileId", "vehicleRegFilePath"],
      ["food_handler", "foodHandlerFileId", "foodHandlerFilePath"],
      ["hipaa", "hipaaFileId", "hipaaFilePath"],
      ["driver_photo", "driverPhotoFileId", "driverPhotoFilePath"],
      ["car_photo", "carPhotoFileId", "carPhotoFilePath"],
      ["equipment_photo", "equipmentPhotoFileId", "equipmentPhotoFilePath"],
    ])("maps %s to %s -> %s", async (category, fileIdField, column) => {
      mockOwnedUploads([ownUpload("file-1", `${prefix}${category}`, "doc.pdf")]);

      const response = await POST(buildRequest({ ...baseBody, [fileIdField]: "file-1" }, TOKEN));

      expect(response.status).toBe(200);
      expect(columnsWritten()).toEqual({
        [column]: expect.stringMatching(/^job-applications\/app-1\/doc_\d+\.pdf$/),
      });
    });
  });

  // Regression guard: an unknown category is linked but writes no column.
  it.each(["other", "job-applications/temp/other", "uploads/license"])(
    "links a %p upload without writing any column",
    async (category) => {
      mockOwnedUploads([ownUpload("file-1", category, "doc.pdf")]);

      const response = await POST(buildRequest({ ...baseBody, resumeFileId: "file-1" }, TOKEN));

      expect(response.status).toBe(200);
      expect(prisma.fileUpload.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "file-1" } }),
      );
      expect(prisma.jobApplication.update).not.toHaveBeenCalled();
    },
  );

  // Regression guard: legacy driver photo and equipment photo uploads keep their old columns.
  it("still writes legacy driver photo and equipment photo uploads to their old columns", async () => {
    mockOwnedUploads([
      ...requiredUploads().uploads,
      ownUpload("driver-file", "job-applications/temp/driver_photo", "driver.jpg"),
      ownUpload("equipment-file", "equipment_photo", "equipment.jpg"),
    ]);

    const response = await POST(
      buildRequest(
        {
          ...driverBody,
          driverPhotoFileId: "driver-file",
          equipmentPhotoFileId: "equipment-file",
        },
        TOKEN,
      ),
    );

    expect(response.status).toBe(200);
    expect(columnsWritten()).toEqual(
      expect.objectContaining({
        driverPhotoFilePath: expect.stringMatching(/^job-applications\/app-1\/driver_\d+\.jpg$/),
        equipmentPhotoFilePath: expect.stringMatching(
          /^job-applications\/app-1\/equipment_\d+\.jpg$/,
        ),
      }),
    );
  });
});

describe("POST /api/job-applications - admin notification email", () => {
  const PII = ["Ada", "Lovelace", "ada@example.com", "415-555-0100", "resume.pdf"];

  beforeEach(() => {
    jest.clearAllMocks();
    deferredWork = [];
    (createAdminClient as jest.Mock).mockResolvedValue({ storage: { from: jest.fn() } });
    (createClient as jest.Mock).mockResolvedValue({});
    (prisma.jobApplication.create as jest.Mock).mockResolvedValue({
      id: "app-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "415-555-0100",
      position: "Server",
    });
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "415-555-0100",
      fileUploads: [{ category: "resume", fileName: "resume.pdf", fileUrl: "https://signed" }],
    });
    (sendEmail as jest.Mock).mockResolvedValue(undefined);
  });

  function sentryPayloads(): string {
    return JSON.stringify([
      (Sentry.captureException as jest.Mock).mock.calls.map((call) => call[1]),
      (Sentry.captureMessage as jest.Mock).mock.calls,
    ]);
  }

  it("does not block the response on the admin email", async () => {
    const response = await POST(
      buildRequest({ ...baseBody, phone: "415-555-0100" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: "app-1" });
    expect(runAfterResponse).toHaveBeenCalledWith(
      "job-application-admin-email",
      expect.any(Function),
    );
    expect(sendEmail).not.toHaveBeenCalled();

    await flushAfterResponse();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.jobApplication.findUnique).toHaveBeenCalledWith({
      where: { id: "app-1", deletedAt: null },
      include: { fileUploads: true },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("still returns success and reports to Sentry without PII when sendEmail rejects", async () => {
    const emailError = new Error("Resend unavailable");
    (sendEmail as jest.Mock).mockRejectedValue(emailError);

    const response = await POST(
      buildRequest({ ...baseBody, phone: "415-555-0100" }),
    );
    await flushAfterResponse();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: "app-1" });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      emailError,
      expect.objectContaining({
        tags: expect.objectContaining({ operation: "job_application_admin_email" }),
        extra: expect.objectContaining({ jobApplicationId: "app-1" }),
      }),
    );
    for (const value of PII) {
      expect(sentryPayloads()).not.toContain(value);
    }
  });

  it("still returns success and reports to Sentry without PII when the refetch returns null", async () => {
    (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      buildRequest({ ...baseBody, phone: "415-555-0100" }),
    );
    await flushAfterResponse();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: "app-1" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        level: "error",
        tags: expect.objectContaining({ operation: "job_application_admin_email" }),
        extra: expect.objectContaining({ jobApplicationId: "app-1" }),
      }),
    );
    for (const value of PII) {
      expect(sentryPayloads()).not.toContain(value);
    }
  });

  it("reports to Sentry when the refetch itself throws", async () => {
    const dbError = new Error("connection reset");
    (prisma.jobApplication.findUnique as jest.Mock).mockRejectedValue(dbError);

    const response = await POST(buildRequest(baseBody));
    await flushAfterResponse();

    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({
        tags: expect.objectContaining({ operation: "job_application_admin_email" }),
        extra: expect.objectContaining({ jobApplicationId: "app-1" }),
      }),
    );
  });
});
