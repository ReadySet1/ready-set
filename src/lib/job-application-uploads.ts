import type { FileUpload, Prisma } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Binds the file IDs a job-application submitter sends to the upload session
 * that actually uploaded them.
 *
 * The public submit endpoint receives FileUpload IDs from the browser. Without
 * this check, anyone who learns another applicant's file ID could pull that
 * document into their own application. Uploads made through
 * /api/file-uploads with an `x-upload-token` are stored under
 * `job-applications/temp/<session.id>/`, so a file is only accepted when it
 * lives under the folder of the session identified by the caller's token and
 * is not already linked to an application.
 */

type ApplicationSession = Database["public"]["Tables"]["application_sessions"]["Row"];

export interface OwnedUploadsPrisma {
  fileUpload: {
    findMany(args: { where: Prisma.FileUploadWhereInput }): Promise<FileUpload[]>;
  };
}

export interface ResolveOwnedApplicationUploadsInput {
  uploadToken: string | null | undefined;
  fileIds: string[];
  supabaseAdmin: Pick<SupabaseClient<Database>, "from">;
  prisma: OwnedUploadsPrisma;
}

export type ResolveOwnedApplicationUploadsResult =
  | { ok: true; files: FileUpload[]; sessionId: string | null }
  | { ok: false; status: number; error: string };

const MISSING_SESSION_ERROR =
  "Your upload session is missing or expired. Please reload the page and try again.";
const COMPLETED_SESSION_ERROR =
  "This application session has already been submitted. Please reload the page to start a new application.";
const UNVERIFIED_FILES_ERROR = "One or more uploaded files could not be verified";

export function sessionUploadPrefix(sessionId: string): string {
  return `job-applications/temp/${sessionId}/`;
}

export async function resolveOwnedApplicationUploads({
  uploadToken,
  fileIds,
  supabaseAdmin,
  prisma,
}: ResolveOwnedApplicationUploadsInput): Promise<ResolveOwnedApplicationUploadsResult> {
  const requestedIds = Array.from(new Set(fileIds));

  if (requestedIds.length === 0) {
    return { ok: true, files: [], sessionId: null };
  }

  if (!uploadToken) {
    return { ok: false, status: 401, error: MISSING_SESSION_ERROR };
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("application_sessions")
    .select("id, session_expires_at, completed")
    .eq("session_token", uploadToken)
    .single<Pick<ApplicationSession, "id" | "session_expires_at" | "completed">>();

  if (sessionError || !session) {
    return { ok: false, status: 401, error: MISSING_SESSION_ERROR };
  }

  if (new Date(session.session_expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: MISSING_SESSION_ERROR };
  }

  if (session.completed) {
    return { ok: false, status: 410, error: COMPLETED_SESSION_ERROR };
  }

  const prefix = sessionUploadPrefix(session.id);
  const files = await prisma.fileUpload.findMany({
    where: {
      id: { in: requestedIds },
      jobApplicationId: null,
      filePath: { startsWith: prefix },
    },
  });

  // Re-check in memory so a permissive query layer can never widen the result,
  // and never accept a partial match.
  const verified = files.filter(
    (file) =>
      requestedIds.includes(file.id) &&
      file.jobApplicationId === null &&
      typeof file.filePath === "string" &&
      file.filePath.startsWith(prefix),
  );

  if (verified.length !== requestedIds.length || files.length !== requestedIds.length) {
    return { ok: false, status: 400, error: UNVERIFIED_FILES_ERROR };
  }

  return { ok: true, files: verified, sessionId: session.id };
}
