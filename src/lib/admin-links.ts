import { siteUrl } from "@/lib/site-url";

/**
 * Query parameter the admin job-applications page reads to open one
 * application's detail dialog. There is no `/admin/job-applications/[id]`
 * page, so emailed links must deep-link through the list.
 */
export const JOB_APPLICATION_ID_PARAM = "id";

/** Absolute admin link to a single job application, for emails. */
export function jobApplicationAdminUrl(id: string): string {
  return siteUrl(
    `/admin/job-applications?${JOB_APPLICATION_ID_PARAM}=${encodeURIComponent(id)}`,
  );
}
