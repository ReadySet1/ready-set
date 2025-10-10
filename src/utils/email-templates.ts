// utils/email-templates.ts
import {
  JobApplicationData,
  UserRegistrationData,
  QuoteRequestData,
} from "../types/email";

/**
 * Ready Set Brand Colors - Comprehensive Design System
 * Unified across all email templates with full color palette
 */
export const BRAND_COLORS = {
  // Primary Brand Colors
  primary: '#FBD113',        // Ready Set Yellow (primary brand color)
  primaryDark: '#E5BE00',    // Darker yellow for hover states
  primaryLight: '#FDE68A',   // Lighter yellow for backgrounds
  secondary: '#FFC61A',      // Custom yellow (secondary brand)
  secondaryDark: '#F59E0B',  // Darker orange-yellow
  accent: '#FF6B35',         // Accent orange for highlights

  // Text Colors
  text: {
    primary: '#1A1A1A',      // Main text color (dark)
    secondary: '#4B5563',    // Secondary text (medium gray)
    muted: '#9CA3AF',        // Muted text (light gray)
    inverse: '#FFFFFF',      // White text for dark backgrounds
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',      // White background
    secondary: '#F9FAFB',    // Light gray background
    tertiary: '#F5F5F5',     // Slightly darker gray
    dark: '#1F2937',         // Dark background
  },

  // Button Styles
  button: {
    primary: {
      bg: '#FBD113',         // Yellow background
      text: '#1A1A1A',       // Dark text
      hover: '#E5BE00',      // Darker yellow on hover
      border: '#E5BE00',     // Border color
    },
    secondary: {
      bg: '#FFFFFF',         // White background
      text: '#1A1A1A',       // Dark text
      hover: '#F9FAFB',      // Light gray on hover
      border: '#E5E7EB',     // Border color
    },
    tertiary: {
      bg: 'transparent',     // Transparent background
      text: '#FBD113',       // Yellow text
      hover: '#FEF3C7',      // Very light yellow on hover
      border: '#FBD113',     // Yellow border
    },
  },

  // Status Colors
  status: {
    success: '#10B981',      // Green for success
    successBg: '#D1FAE5',    // Light green background
    successBorder: '#6EE7B7', // Green border
    error: '#EF4444',        // Red for errors
    errorBg: '#FEE2E2',      // Light red background
    errorBorder: '#FCA5A5',  // Red border
    warning: '#F59E0B',      // Orange for warnings
    warningBg: '#FEF3C7',    // Light yellow background
    warningBorder: '#FCD34D', // Yellow border
    info: '#3B82F6',         // Blue for info
    infoBg: '#DBEAFE',       // Light blue background
    infoBorder: '#93C5FD',   // Blue border
  },

  // Border Colors
  border: {
    light: '#E5E7EB',        // Light border
    medium: '#D1D5DB',       // Medium border
    dark: '#9CA3AF',         // Dark border
    primary: '#FBD113',      // Yellow border
  },

  // Utility Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Legacy aliases (for backward compatibility)
  dark: '#1A1A1A',
  lightGray: '#F5F5F5',
  mediumGray: '#666666',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
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
 * Generate call-to-action button with multiple style variants
 * @param url - Button destination URL
 * @param text - Button text
 * @param variant - Button style variant: 'primary' | 'secondary' | 'tertiary'
 */
export const generateCTAButton = (
  url: string,
  text: string,
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
) => {
  const styles = {
    primary: `background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%); color: ${BRAND_COLORS.button.primary.text}; border: 2px solid ${BRAND_COLORS.button.primary.border};`,
    secondary: `background: ${BRAND_COLORS.button.secondary.bg}; color: ${BRAND_COLORS.button.secondary.text}; border: 2px solid ${BRAND_COLORS.button.secondary.border};`,
    tertiary: `background: ${BRAND_COLORS.button.tertiary.bg}; color: ${BRAND_COLORS.button.tertiary.text}; border: 2px solid ${BRAND_COLORS.button.tertiary.border};`,
  };

  return `
  <div style="text-align: center; margin: 30px 0;">
    <a href="${url}" style="${styles[variant]} padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s ease;">${text}</a>
  </div>
`;
};

/**
 * Generate info box with standardized status colors
 * @param content - HTML content to display in the box
 * @param type - Box type: 'info' | 'success' | 'warning' | 'error'
 */
export const generateInfoBox = (
  content: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) => {
  const colors = {
    info: {
      bg: BRAND_COLORS.status.infoBg,
      border: BRAND_COLORS.status.infoBorder,
      text: BRAND_COLORS.text.primary,
      link: BRAND_COLORS.status.info,
    },
    success: {
      bg: BRAND_COLORS.status.successBg,
      border: BRAND_COLORS.status.successBorder,
      text: BRAND_COLORS.text.primary,
      link: BRAND_COLORS.status.success,
    },
    warning: {
      bg: BRAND_COLORS.status.warningBg,
      border: BRAND_COLORS.status.warningBorder,
      text: BRAND_COLORS.text.primary,
      link: BRAND_COLORS.status.warning,
    },
    error: {
      bg: BRAND_COLORS.status.errorBg,
      border: BRAND_COLORS.status.errorBorder,
      text: BRAND_COLORS.text.primary,
      link: BRAND_COLORS.status.error,
    },
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
 * Generate a divider line for visual separation
 * @param color - Optional color override (defaults to border.light)
 */
export const generateDivider = (color?: string) => `
  <div style="border-top: 1px solid ${color || BRAND_COLORS.border.light}; margin: 20px 0;"></div>
`;

/**
 * Generate a spacer for vertical spacing
 * @param height - Height in pixels (default: 20)
 */
export const generateSpacer = (height: number = 20) => `
  <div style="height: ${height}px;"></div>
`;

/**
 * Generate a hero section for important announcements
 * @param title - Hero title
 * @param subtitle - Optional subtitle
 * @param imageUrl - Optional hero image URL
 */
export const generateHeroSection = (params: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
}) => {
  const { title, subtitle, imageUrl } = params;

  return `
    <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, ${BRAND_COLORS.primaryLight} 0%, ${BRAND_COLORS.background.secondary} 100%); border-radius: 10px; margin: 20px 0;">
      ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 6px; margin-bottom: 20px;" />` : ''}
      <h2 style="color: ${BRAND_COLORS.text.primary}; font-size: 32px; margin: 0 0 10px 0; font-weight: bold;">${title}</h2>
      ${subtitle ? `<p style="color: ${BRAND_COLORS.text.secondary}; font-size: 18px; margin: 0;">${subtitle}</p>` : ''}
    </div>
  `;
};

/**
 * Generate an ordered list component
 * @param items - Array of list item strings
 * @param title - Optional section title
 */
export const generateOrderedList = (items: string[], title?: string) => {
  const listItems = items.map(item => `
    <li style="margin-bottom: 10px; color: ${BRAND_COLORS.text.primary};">${item}</li>
  `).join('');

  return `
    ${title ? `<h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">${title}</h3>` : ''}
    <ol style="padding-left: 20px; color: ${BRAND_COLORS.text.primary}; line-height: 1.6;">
      ${listItems}
    </ol>
  `;
};

/**
 * Generate an unordered list component
 * @param items - Array of list item strings
 * @param title - Optional section title
 */
export const generateUnorderedList = (items: string[], title?: string) => {
  const listItems = items.map(item => `
    <li style="margin-bottom: 10px; color: ${BRAND_COLORS.text.primary};">${item}</li>
  `).join('');

  return `
    ${title ? `<h3 style="color: ${BRAND_COLORS.text.primary}; font-size: 18px; margin-top: 25px;">${title}</h3>` : ''}
    <ul style="padding-left: 20px; color: ${BRAND_COLORS.text.primary}; line-height: 1.6;">
      ${listItems}
    </ul>
  `;
};

/**
 * Generate a text content block with optional styling
 * @param content - HTML content
 * @param variant - Text variant: 'body' | 'large' | 'small'
 */
export const generateContentBlock = (
  content: string,
  variant: 'body' | 'large' | 'small' = 'body'
) => {
  const sizes = {
    body: '16px',
    large: '18px',
    small: '14px',
  };

  return `
    <p style="font-size: ${sizes[variant]}; color: ${BRAND_COLORS.text.primary}; line-height: 1.6; margin: 15px 0;">
      ${content}
    </p>
  `;
};

/**
 * Generate a two-column layout (for desktop)
 * @param leftContent - HTML content for left column
 * @param rightContent - HTML content for right column
 */
export const generateTwoColumnLayout = (leftContent: string, rightContent: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
    <tr>
      <td width="48%" style="vertical-align: top; padding-right: 2%;">
        ${leftContent}
      </td>
      <td width="48%" style="vertical-align: top; padding-left: 2%;">
        ${rightContent}
      </td>
    </tr>
  </table>
`;

/**
 * Generate a status badge
 * @param text - Badge text
 * @param status - Badge status: 'success' | 'warning' | 'error' | 'info'
 */
export const generateStatusBadge = (
  text: string,
  status: 'success' | 'warning' | 'error' | 'info' = 'info'
) => {
  const colors = {
    success: { bg: BRAND_COLORS.status.success, text: BRAND_COLORS.text.inverse },
    warning: { bg: BRAND_COLORS.status.warning, text: BRAND_COLORS.text.primary },
    error: { bg: BRAND_COLORS.status.error, text: BRAND_COLORS.text.inverse },
    info: { bg: BRAND_COLORS.status.info, text: BRAND_COLORS.text.inverse },
  };

  const style = colors[status];

  return `
    <span style="display: inline-block; background: ${style.bg}; color: ${style.text}; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; margin: 5px 0;">
      ${text}
    </span>
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
