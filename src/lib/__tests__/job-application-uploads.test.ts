import { resolveOwnedApplicationUploads } from "@/lib/job-application-uploads";

const SESSION_ID = "session-abc";
const TOKEN = "a".repeat(64);

type SessionRow = {
  id: string;
  session_expires_at: string;
  completed: boolean | null;
};

function buildSupabase(session: SessionRow | null) {
  const single = jest.fn().mockResolvedValue(
    session
      ? { data: session, error: null }
      : { data: null, error: { message: "No rows found", code: "PGRST116" } },
  );
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { client: { from } as any, from, select, eq, single };
}

function buildPrisma(rows: Array<Record<string, unknown>>) {
  const findMany = jest.fn().mockResolvedValue(rows);
  return { client: { fileUpload: { findMany } } as any, findMany };
}

const activeSession: SessionRow = {
  id: SESSION_ID,
  session_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  completed: false,
};

function ownedRow(id: string) {
  return {
    id,
    filePath: `job-applications/temp/${SESSION_ID}/${id}.pdf`,
    jobApplicationId: null,
  };
}

describe("resolveOwnedApplicationUploads", () => {
  it("returns no files and does not require a token when no file IDs are requested", async () => {
    const supabase = buildSupabase(null);
    const prisma = buildPrisma([]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: null,
      fileIds: [],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toEqual({ ok: true, files: [], sessionId: null });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it("rejects with 401 when file IDs are present but the upload token is missing", async () => {
    const supabase = buildSupabase(activeSession);
    const prisma = buildPrisma([]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: null,
      fileIds: ["file-1"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
    if (!result.ok) {
      expect(result.error).toMatch(/upload session is missing or expired/i);
    }
    expect(supabase.from).not.toHaveBeenCalled();
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the upload token does not match any session", async () => {
    const supabase = buildSupabase(null);
    const prisma = buildPrisma([ownedRow("file-1")]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(supabase.from).toHaveBeenCalledWith("application_sessions");
    expect(supabase.eq).toHaveBeenCalledWith("session_token", TOKEN);
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the session has expired", async () => {
    const supabase = buildSupabase({
      ...activeSession,
      session_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const prisma = buildPrisma([ownedRow("file-1")]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
    if (!result.ok) {
      expect(result.error).toMatch(/expired/i);
    }
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it("rejects with 410 when the session is already completed", async () => {
    const supabase = buildSupabase({ ...activeSession, completed: true });
    const prisma = buildPrisma([ownedRow("file-1")]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 410 });
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it("queries only unlinked files stored under the session's own temp folder", async () => {
    const supabase = buildSupabase(activeSession);
    const prisma = buildPrisma([ownedRow("file-1"), ownedRow("file-2")]);

    await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1", "file-2"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(prisma.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["file-1", "file-2"] },
        jobApplicationId: null,
        filePath: { startsWith: `job-applications/temp/${SESSION_ID}/` },
      },
    });
  });

  it("rejects with 400 when a requested file belongs to another session's path", async () => {
    const supabase = buildSupabase(activeSession);
    // The DB filter excludes the foreign file, so only the owned one comes back.
    const prisma = buildPrisma([ownedRow("file-1")]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1", "someone-elses-license"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "One or more uploaded files could not be verified",
    });
  });

  it("rejects with 400 when a requested file is already linked to an application", async () => {
    const supabase = buildSupabase(activeSession);
    // Linked rows are excluded by the jobApplicationId: null filter.
    const prisma = buildPrisma([]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["already-linked"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects rows the store returns outside the session folder or already linked", async () => {
    const supabase = buildSupabase(activeSession);
    const prisma = buildPrisma([
      ownedRow("file-1"),
      {
        id: "file-2",
        filePath: "job-applications/temp/other-session/file-2.pdf",
        jobApplicationId: null,
      },
    ]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1", "file-2"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });

    const linkedPrisma = buildPrisma([
      { ...ownedRow("file-3"), jobApplicationId: "app-9" },
    ]);
    const linkedResult = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-3"],
      supabaseAdmin: buildSupabase(activeSession).client,
      prisma: linkedPrisma.client,
    });

    expect(linkedResult).toMatchObject({ ok: false, status: 400 });
  });

  it("deduplicates repeated file IDs before querying and counting", async () => {
    const supabase = buildSupabase(activeSession);
    const prisma = buildPrisma([ownedRow("file-1")]);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1", "file-1"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(prisma.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: ["file-1"] } }),
    });
    expect(result).toEqual({
      ok: true,
      files: [ownedRow("file-1")],
      sessionId: SESSION_ID,
    });
  });

  it("returns the owned rows and session id on the happy path", async () => {
    const supabase = buildSupabase(activeSession);
    const rows = [ownedRow("file-1"), ownedRow("file-2")];
    const prisma = buildPrisma(rows);

    const result = await resolveOwnedApplicationUploads({
      uploadToken: TOKEN,
      fileIds: ["file-1", "file-2"],
      supabaseAdmin: supabase.client,
      prisma: prisma.client,
    });

    expect(result).toEqual({ ok: true, files: rows, sessionId: SESSION_ID });
    expect(supabase.select).toHaveBeenCalledWith(
      expect.stringContaining("session_expires_at"),
    );
  });
});
