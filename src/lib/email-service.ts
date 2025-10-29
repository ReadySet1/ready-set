// src/lib/email-service.ts

import { Resend } from "resend";
import { sendEmailWithResilience } from "@/utils/email-resilience";
import {
  FormType,
  DeliveryFormData,
} from "@/components/Logistics/QuoteRequest/types";
import DOMPurify from "isomorphic-dompurify";

// Lazy initialization to avoid build-time errors when API key is not set
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

export class EmailService {
  static async sendFormSubmissionNotification(data: {
    formType: FormType;
    formData: DeliveryFormData;
    submissionId: string;
  }) {
    const { formType, formData, submissionId } = data;
    const {
      companyName,
      contactName,
      email,
      phone,
      website,
      counties,
      additionalComments,
      pickupAddress,
      ...specifications
    } = formData;

    const formattedAddress = pickupAddress
      ? (() => {
          const addressParts = [
            pickupAddress.street,
            pickupAddress.city,
            pickupAddress.state,
            pickupAddress.zip
          ].filter(part => part && part !== "undefined");
          return addressParts.length > 0 ? addressParts.join(", ") : "N/A";
        })()
      : "N/A";

    // Improved specifications handling with sanitization
    const formatSpecificationValue = (value: any): string => {
      if (value === null || value === undefined) return "N/A";
      if (Array.isArray(value)) {
        return value.map(v => DOMPurify.sanitize(String(v), { ALLOWED_TAGS: [], KEEP_CONTENT: true })).join(", ");
      }
      if (typeof value === "object") {
        // Handle nested objects
        return Object.entries(value)
          .map(([k, v]) => {
            const sanitizedKey = DOMPurify.sanitize(String(k), { ALLOWED_TAGS: [], KEEP_CONTENT: true });
            return `${sanitizedKey}: ${formatSpecificationValue(v)}`;
          })
          .join(", ");
      }
      return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], KEEP_CONTENT: true });
    };

    // Create HTML content for specifications with improved formatting
    const specsList = Object.entries(specifications)
      .map(([key, value]) => {
        // Convert camelCase to Title Case
        const formattedKey = DOMPurify.sanitize(
          key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, str => str.toUpperCase())
            .trim(),
          { ALLOWED_TAGS: [], KEEP_CONTENT: true }
        );
        const formattedValue = formatSpecificationValue(value);
        return `<li><strong>${formattedKey}:</strong> ${formattedValue}</li>`;
      })
      .join("");

    const formTypeDisplay = formType
      ? formType.replace(/_/g, "-").split("-").map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join("-")
      : "Unknown";

    // Sanitize all user inputs to prevent HTML injection attacks
    const sanitize = (input: string | undefined | null): string => {
      if (!input) return "N/A";
      return DOMPurify.sanitize(String(input), {
        ALLOWED_TAGS: [], // Strip all HTML tags, keep only text
        KEEP_CONTENT: true
      });
    };

    const htmlContent = `
      <h2>New ${sanitize(formTypeDisplay)} Delivery Quote Request</h2>
      <p>Submission ID: ${sanitize(submissionId)}</p>

      <h3>Contact Information</h3>
      <ul>
        <li><strong>Company:</strong> ${sanitize(companyName)}</li>
        <li><strong>Contact Name:</strong> ${sanitize(contactName)}</li>
        <li><strong>Email:</strong> ${sanitize(email)}</li>
        <li><strong>Phone:</strong> ${sanitize(phone)}</li>
        <li><strong>Website:</strong> ${sanitize(website)}</li>
      </ul>

      <h3>Delivery Details</h3>
      <ul>
        <li><strong>Counties:</strong> ${counties ? counties.map(c => sanitize(c)).join(", ") : "N/A"}</li>
        <li><strong>Pickup Address:</strong> ${sanitize(formattedAddress)}</li>
      </ul>

      ${specsList ? `
      <h3>Service Specifications</h3>
      <ul>
        ${DOMPurify.sanitize(specsList, { ALLOWED_TAGS: ['li', 'strong'], KEEP_CONTENT: true })}
      </ul>
      ` : ""}

      <h3>Additional Information</h3>
      <p>${sanitize(additionalComments)}</p>
    `;

    // Use resilience wrapper with retry, circuit breaker, and timeout
    await sendEmailWithResilience(async () => {
      const resend = getResendClient();
      if (!resend) {
        console.warn("⚠️  Resend client not available - skipping notification email");
        throw new Error("Email service not configured");
      }

      return await resend.emails.send({
        to: process.env.NOTIFICATION_RECIPIENT || 'info@ready-set.co',
        from: 'Ready Set Website <updates@updates.readysetllc.com>',
        subject: `New ${formTypeDisplay} Delivery Quote Request - ${companyName}`,
        html: htmlContent,
        text: htmlContent.replace(/<[^>]*>/g, ""), // Strip HTML for plain text version
      });
    });
  }
}
