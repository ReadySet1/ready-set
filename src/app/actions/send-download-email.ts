"use server";

import { Resend } from 'resend';
import { resources } from "@/components/Resources/Data/Resources";
import { generateSlug } from "@/lib/create-slug";
import { DownloadEmailTemplate } from '@/components/Resources/DownloadEmailTemplate';

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

export const sendDownloadEmail = async (
  userEmail: string,
  firstName: string,
  resourceSlug: ResourceSlug,
  resourceUrl?: string, // Add optional resourceUrl parameter
) => {
  try {
    // Input validation
    if (!userEmail || !firstName || !resourceSlug) {
      throw new Error("Missing required parameters for sending download email");
    }

    const resource = RESOURCE_MAP[resourceSlug];
    if (!resource && !resourceUrl) {
      throw new Error(`Resource not found or missing download URL: ${resourceSlug}`);
    }

    // Use the provided resourceUrl if available, otherwise fall back to the resource's downloadUrl
    const downloadUrl = resourceUrl || (resource?.downloadUrl);
    
    if (!downloadUrl) {
      throw new Error(`No download URL available for resource: ${resourceSlug}`);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      throw new Error("Invalid email format");
    }

    
    // Get the title from the resource map or use a default if not found
    const resourceTitle = resource?.title || "Resource";

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