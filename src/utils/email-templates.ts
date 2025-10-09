// utils/email-templates.ts
import {
  JobApplicationData,
  UserRegistrationData,
  QuoteRequestData,
} from "../types/email";

/**
 * Ready Set Brand Colors - Unified across all email templates
 */
export const BRAND_COLORS = {
  primary: '#FBD113',        // Ready Set Yellow (primary brand color)
  primaryDark: '#E5BE00',    // Darker yellow for hover states
  secondary: '#FFC61A',      // Custom yellow
  dark: '#1A1A1A',           // Dark text
  lightGray: '#F5F5F5',      // Light background
  mediumGray: '#666666',     // Medium text
  white: '#FFFFFF',          // White
  success: '#10B981',        // Green for success messages
  warning: '#F59E0B',        // Orange for warnings
  info: '#3B82F6',           // Blue for info
};

/**
 * Generate email header with Ready Set branding
 */
export const generateEmailHeader = (title: string) => {
  // Use hardcoded public URL for maximum email client compatibility
  // Email clients often block images from variable URLs or localhost
  const logoUrl = 'https://www.readysetllc.com/images/logo/full-logo-dark.png';

  return `
  <div style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 20px;">
          <img src="${logoUrl}" alt="Ready Set Logo" width="200" height="auto" style="max-width: 200px; height: auto; display: block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" />
        </td>
      </tr>
      <tr>
        <td align="center">
          <h1 style="color: ${BRAND_COLORS.dark}; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${title}</h1>
        </td>
      </tr>
    </table>
  </div>
`;
};

/**
 * Generate email footer with company information
 */
export const generateEmailFooter = () => {
  const currentYear = new Date().getFullYear();
  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: ${BRAND_COLORS.mediumGray}; font-size: 14px;">
      <p style="margin: 10px 0;">Need help? Contact us at <a href="mailto:support@readysetllc.com" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 500;">support@readysetllc.com</a></p>
      <p style="margin: 10px 0;">&copy; ${currentYear} Ready Set LLC. All rights reserved.</p>
      <p style="margin: 10px 0; font-size: 12px;">Multi-User Delivery Service Platform</p>
    </div>
  `;
};

/**
 * Generate call-to-action button
 */
export const generateCTAButton = (url: string, text: string) => `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${url}" style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%); color: ${BRAND_COLORS.dark}; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${text}</a>
  </div>
`;

/**
 * Generate info box
 */
export const generateInfoBox = (content: string, type: 'info' | 'success' | 'warning' = 'info') => {
  const colors = {
    info: { bg: '#1E3A4C', border: '#2A5570', text: '#FFFFFF', link: '#FBD113' },
    success: { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', link: '#047857' },
    warning: { bg: '#FFF3CD', border: '#FFC107', text: '#856404', link: '#92400E' },
  };

  const style = colors[type];
  
  // Replace link colors in content to match the info box type
  // This handles both cases: links with existing color styles and links without styles
  let styledContent = content.replace(
    /(<a[^>]*style="[^"]*?)color:\s*[^;"]+(;[^"]*")/gi,
    `$1color: ${style.link}$2`
  );
  
  // For links without a color in their style or without a style attribute
  styledContent = styledContent.replace(
    /<a\s+([^>]*?)(?:style="([^"]*)")?([^>]*?)>/gi,
    (match, before, existingStyle, after) => {
      const hasColorStyle = existingStyle && /color:/i.test(existingStyle);
      if (hasColorStyle) {
        return match; // Already handled by previous replace
      }
      const newStyle = existingStyle 
        ? `${existingStyle} color: ${style.link}; text-decoration: none; font-weight: 600;`
        : `color: ${style.link}; text-decoration: none; font-weight: 600;`;
      return `<a ${before}style="${newStyle}"${after}>`;
    }
  );

  return `
    <div style="background: ${style.bg}; border: 1px solid ${style.border}; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; color: ${style.text};">${styledContent}</p>
    </div>
  `;
};

/**
 * Generate details table for order/user information
 */
export const generateDetailsTable = (details: Array<{ label: string; value: string }>) => {
  const rows = details.map(({ label, value }) => `
    <tr>
      <td style="padding: 10px 0; font-weight: 600; color: ${BRAND_COLORS.mediumGray}; width: 40%;">${label}:</td>
      <td style="padding: 10px 0; color: ${BRAND_COLORS.dark};">${value}</td>
    </tr>
  `).join('');

  return `
    <div style="background: ${BRAND_COLORS.lightGray}; padding: 20px; border-left: 4px solid ${BRAND_COLORS.primary}; border-radius: 6px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>
    </div>
  `;
};

/**
 * Generate complete unified email template
 */
export const generateUnifiedEmailTemplate = (params: {
  title: string;
  greeting: string;
  content: string;
  ctaUrl?: string;
  ctaText?: string;
  infoMessage?: string;
  infoType?: 'info' | 'success' | 'warning';
}) => {
  const { title, greeting, content, ctaUrl, ctaText, infoMessage, infoType = 'info' } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${BRAND_COLORS.dark}; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        ${generateEmailHeader(title)}

        <div style="background: ${BRAND_COLORS.white}; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0; font-size: 22px;">${greeting}</h2>

          ${content}

          ${ctaUrl && ctaText ? generateCTAButton(ctaUrl, ctaText) : ''}

          ${infoMessage ? generateInfoBox(infoMessage, infoType) : ''}

          ${generateEmailFooter()}
        </div>
      </body>
    </html>
  `;
};

export const generateJobApplicationEmail = (data: JobApplicationData) => {
  return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>New Job Application</h2>
        <div style="margin: 20px 0;">
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Message:</strong></p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${data.message}
          </div>
        </div>
      </div>
    `;
};

export const generateUserRegistrationEmail = (data: UserRegistrationData) => {
  return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>New User Registration</h2>
        <div style="margin: 20px 0;">
          <p><strong>User Type:</strong> ${data.userType}</p>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Company:</strong> ${data.company}</p>
          <p>Please review this registration in the admin dashboard.</p>
        </div>
      </div>
    `;
};

export const generateQuoteRequestEmail = (data: QuoteRequestData) => {
  return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>New Food Delivery Quote Request</h2>
        <p><strong>Submission ID:</strong> ${data.submissionId}</p>
        
        <h3>Contact Information</h3>
        <div style="margin: 10px 0;">
          <p><strong>Company:</strong> ${data.company}</p>
          <p><strong>Contact Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          ${data.website ? `<p><strong>Website:</strong> ${data.website}</p>` : ""}
        </div>
  
        <h3>Delivery Details</h3>
        <div style="margin: 10px 0;">
          <p><strong>Counties:</strong> ${data.counties.join(", ")}</p>
          <p><strong>Pickup Address:</strong> ${data.pickupAddress}</p>
        </div>
  
        <h3>Service Specifications</h3>
        <div style="margin: 10px 0;">
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${JSON.stringify(data.specifications, null, 2)}
          </pre>
        </div>
  
        ${
          data.additionalInfo
            ? `
          <h3>Additional Information</h3>
          <div style="margin: 10px 0;">
            <p>${data.additionalInfo}</p>
          </div>
        `
            : ""
        }
      </div>
    `;
};
