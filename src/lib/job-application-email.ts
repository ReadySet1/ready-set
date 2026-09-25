import { jobApplicationAdminUrl } from "@/lib/admin-links";
import { escapeHtml } from "@/lib/utils/escape-html";

/** The uploaded-file fields the admin notification email renders. */
export interface JobApplicationEmailFile {
  category: string | null;
  fileName: string | null;
  fileUrl: string | null;
}

/**
 * Build the HTML body of the "new job application" email sent to admins.
 *
 * Every applicant field is listed with a label derived from its key, followed
 * by a link per uploaded document. All interpolated values are HTML-escaped:
 * the application comes from a public form, so its fields are untrusted.
 */
export function buildJobApplicationEmailHtml(
  application: { id: string } & Record<string, unknown>,
  files: JobApplicationEmailFile[],
): string {
  let htmlBody = `<h1>New Job Application Received</h1>`;
  htmlBody += `<p><strong>Application ID:</strong> <a href="${escapeHtml(jobApplicationAdminUrl(application.id))}">${escapeHtml(application.id)}</a></p>`;
  htmlBody += `<h2>Applicant Details:</h2><ul>`;

  for (const [key, value] of Object.entries(application)) {
    if (key === "fileUploads" || key === "profile") continue; // Skip relations

    const formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/([Ff]ile[Pp]ath)/, " File Path")
      .replace(/^./, (str) => str.toUpperCase());
    htmlBody += `<li><strong>${escapeHtml(formattedKey)}:</strong> ${escapeHtml(value || "N/A")}</li>`;
  }

  if (files.length > 0) {
    htmlBody += `<h2>Uploaded Documents:</h2><ul>`;
    for (const file of files) {
      const linkText = file.category
        ? file.category.charAt(0).toUpperCase() + file.category.slice(1)
        : file.fileName || "View File";
      if (file.fileUrl) {
        htmlBody += `<li><strong>${escapeHtml(linkText)}:</strong> <a href="${escapeHtml(file.fileUrl)}" target="_blank">Open File</a></li>`;
      } else {
        htmlBody += `<li><strong>${escapeHtml(linkText)}:</strong> Link unavailable (Original Name: ${escapeHtml(file.fileName)})</li>`;
      }
    }
    htmlBody += `</ul>`;
  }

  htmlBody += `</ul>`; // Close Applicant Details list
  return htmlBody;
}
