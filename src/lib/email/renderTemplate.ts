// src/lib/email/renderTemplate.ts
// Minimal, type-safe-ish template renderer for delivery notification emails.
// Uses simple {{variable}} replacement and shared header/footer components.

import fs from "node:fs";
import path from "node:path";

export type DeliveryEmailTemplateId =
  | "delivery-assigned"
  | "driver-en-route-pickup"
  | "driver-arrived-pickup"
  | "order-picked-up"
  | "driver-en-route-delivery"
  | "driver-arrived-delivery"
  | "delivery-completed";

export interface DeliveryTemplateVariables {
  customerName: string;
  orderNumber: string;
  driverName?: string;
  estimatedArrival?: string;
  deliveryAddress: string;
  trackingLink: string;
  supportLink: string;
  currentYear: string;
}

export interface RenderedEmailTemplate {
  html: string;
  text: string;
}

const TEMPLATE_ROOT = path.join(
  process.cwd(),
  "src",
  "templates",
  "emails"
);

const COMPONENTS_ROOT = path.join(TEMPLATE_ROOT, "components");

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|br)[^>]*>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

const loadFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    // In development/test we want a clear failure; in production this will surface
    // as a TemplateRenderError in the email service.
    console.error("Failed to load email template file", {
      filePath,
      error,
    });
    throw new Error(`Email template file not found: ${filePath}`);
  }
};

const interpolate = (
  template: string,
  variables: Record<string, string | undefined>
): string =>
  template.replace(/{{\s*([\w]+)\s*}}/g, (_, key: string) => {
    const value = variables[key];
    return value != null ? htmlEscape(String(value)) : "";
  });

export function renderDeliveryTemplate(
  templateId: DeliveryEmailTemplateId,
  vars: DeliveryTemplateVariables
): RenderedEmailTemplate {
  // Load shared components
  const header = loadFile(path.join(COMPONENTS_ROOT, "header.html"));
  const footer = loadFile(path.join(COMPONENTS_ROOT, "footer.html"));
  const styles = loadFile(path.join(COMPONENTS_ROOT, "styles.css"));

  const htmlTemplatePath = path.join(TEMPLATE_ROOT, `${templateId}.html`);
  const htmlTemplateRaw = loadFile(htmlTemplatePath);

  const shell = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
        ${styles}
        </style>
      </head>
      <body>
        ${header}
        ${htmlTemplateRaw}
        ${footer}
      </body>
    </html>
  `;

  const variables: Record<string, string | undefined> = {
    customerName: vars.customerName,
    orderNumber: vars.orderNumber,
    driverName: vars.driverName,
    estimatedArrival: vars.estimatedArrival,
    deliveryAddress: vars.deliveryAddress,
    trackingLink: vars.trackingLink,
    supportLink: vars.supportLink,
  };

  const html = interpolate(shell, variables);
  const text = stripHtml(html);

  return { html, text };
}


