/**
 * Design Tokens for Address Manager
 * Central source of truth for design system values
 */

export const designTokens = {
  colors: {
    primary: {
      50: 'hsl(221, 83%, 97%)',
      100: 'hsl(221, 83%, 93%)',
      500: 'hsl(221, 83%, 53%)',
      600: 'hsl(221, 83%, 45%)',
      700: 'hsl(221, 83%, 37%)',
    },
    neutral: {
      50: 'hsl(210, 20%, 98%)',
      100: 'hsl(210, 20%, 96%)',
      200: 'hsl(210, 16%, 93%)',
      300: 'hsl(210, 14%, 89%)',
      700: 'hsl(210, 16%, 25%)',
      800: 'hsl(210, 18%, 20%)',
      900: 'hsl(210, 20%, 15%)',
    },
    success: {
      50: 'hsl(142, 76%, 96%)',
      500: 'hsl(142, 71%, 45%)',
      600: 'hsl(142, 76%, 36%)',
    },
    warning: {
      50: 'hsl(48, 96%, 95%)',
      500: 'hsl(48, 96%, 53%)',
    },
  },
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
  },
  borderRadius: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
  },
  typography: {
    fontFamily: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
} as const;

export type DesignTokens = typeof designTokens;
