"use server";

import { Resend } from 'resend';
import { resources } from "@/components/Resources/Data/Resources";
import { generateSlug } from "@/lib/create-slug";
import { DownloadEmailTemplate } from '@/components/Resources/DownloadEmailTemplate';
import { getGuideBySlug } from "@/sanity/lib/queries";

export type ResourceSlug = string;
type Resource = (typeof resources)[number];

const RESOURCE_MAP = resources.reduce(
  (acc: Record<ResourceSlug, Resource>, resource: Resource) => {
    const slug = generateSlug(resource.title);
    return {
      ...acc,
      [slug]: resource,
    };
  },
  {} as Record<ResourceSlug, Resource>,
);

const FROM_EMAIL = "solutions@updates.readysetllc.com";
const FROM_NAME = "Ready Set";

// Lazy initialization to avoid build-time errors when API key is not set
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

export interface DownloadResource {
  title: string;
  downloadUrl: string;
}

/**
 * Resolve a resource slug to its title and download URL.
 *
 * Only server-side sources are trusted for the URL, so the email can never
 * carry a link supplied by the caller: the static resource list first, then
 * the Sanity guide with that slug (`/free-resources/<slug>`), which is not in
 * the static list.
 */
export const resolveDownloadResource = async (
  resourceSlug: ResourceSlug,
): Promise<DownloadResource | null> => {
  const staticResource = RESOURCE_MAP[resourceSlug];
  if (staticResource?.downloadUrl) {
    return { title: staticResource.title, downloadUrl: staticResource.downloadUrl };
  }

  const guide = await getGuideBySlug(resourceSlug);
  const fileUrl = guide?.downloadableFiles?.[0]?.asset?.url;
  if (guide && fileUrl) {
    return { title: guide.title || "Resource", downloadUrl: fileUrl };
  }

  return null;
};

export const sendDownloadEmail = async (
  userEmail: string,
  firstName: string,
  resourceSlug: ResourceSlug,
) => {
  try {
    // Input validation
    if (!userEmail || !firstName || !resourceSlug) {
      throw new Error("Missing required parameters for sending download email");
    }

    const resource = await resolveDownloadResource(resourceSlug);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceSlug}`);
    }

    const { downloadUrl, title: resourceTitle } = resource;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      throw new Error("Invalid email format");
    }


    // Create an async function that returns a Promise<ReactNode>
    const emailTemplate = async () => {
      return DownloadEmailTemplate({ 
        firstName, 
        resourceTitle, 
        downloadUrl, 
        userEmail 
      });
    };

    // Send email using Resend with React template
    const resend = getResendClient();
    if (!resend) {
      console.warn("⚠️  Resend client not available - skipping email");
      throw new Error("Email service not configured");
    }

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [userEmail],
      subject: "Your guide is ready to download",
      react: await emailTemplate(),
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error(`Resend API error: ${error.message}`);
    }

        return true;

  } catch (error) {
    console.error("Download email failed:", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        response: error instanceof Response ? await error.text() : undefined
      } : error,
      config: {
        apiKeyExists: !!process.env.RESEND_API_KEY,
        apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 5),
        fromEmail: FROM_EMAIL
      }
    });

    throw error;
  }
};