/**
 * Ready Set Brand Colors - UI Component Palette
 * Centralized color system for UI components using Tailwind CSS classes
 * 
 * This file provides a consistent color palette based on the amber/yellow brand colors.
 * Use these constants instead of hardcoding color values throughout components.
 */

/**
 * Brand color palette mapping to Tailwind classes
 * Primary brand colors use amber-300/400 as specified in design system
 */
export const brandColors = {
  /**
   * Primary brand colors - Use for main brand elements (buttons, CTAs, highlights)
   */
  primary: {
    light: 'amber-300',      // Light brand color for backgrounds
    DEFAULT: 'amber-400',    // Default brand color (primary)
    dark: 'amber-500',       // Dark brand color for hover states
    text: 'amber-600',       // Text color on brand backgrounds
  },
  
  /**
   * Secondary brand colors - Use for accents and secondary elements
   */
  secondary: {
    light: 'yellow-400',     // Light secondary color
    DEFAULT: 'yellow-500',   // Default secondary color
    dark: 'yellow-600',      // Dark secondary color
  },
  
  /**
   * Semantic colors - Use for status indicators, warnings, etc.
   * Keep yellow for semantic purposes (warnings, highlights)
   */
  semantic: {
    warning: {
      light: 'yellow-100',
      DEFAULT: 'yellow-400',
      dark: 'yellow-600',
    },
    success: {
      light: 'green-100',
      DEFAULT: 'green-500',
      dark: 'green-600',
    },
    error: {
      light: 'red-100',
      DEFAULT: 'red-500',
      dark: 'red-600',
    },
    info: {
      light: 'blue-100',
      DEFAULT: 'blue-500',
      dark: 'blue-600',
    },
  },
} as const;

/**
 * Color mapping for dynamic class generation
 * Use this object to map color names to Tailwind classes
 * Prevents Tailwind purge issues with dynamic class names
 */
export const colorClassMap = {
  yellow: {
    bg: {
      100: 'bg-yellow-100',
      400: 'bg-yellow-400',
      500: 'bg-yellow-500',
      600: 'bg-yellow-600',
    },
    text: {
      100: 'text-yellow-100',
      400: 'text-yellow-400',
      500: 'text-yellow-500',
      600: 'text-yellow-600',
    },
  },
  amber: {
    bg: {
      100: 'bg-amber-100',
      300: 'bg-amber-300',
      400: 'bg-amber-400',
      500: 'bg-amber-500',
      600: 'bg-amber-600',
    },
    text: {
      100: 'text-amber-100',
      300: 'text-amber-300',
      400: 'text-amber-400',
      500: 'text-amber-500',
      600: 'text-amber-600',
    },
  },
  orange: {
    bg: {
      100: 'bg-orange-100',
      400: 'bg-orange-400',
      500: 'bg-orange-500',
      600: 'bg-orange-600',
    },
    text: {
      100: 'text-orange-100',
      400: 'text-orange-400',
      500: 'text-orange-500',
      600: 'text-orange-600',
    },
  },
} as const;

/**
 * Helper function to get background color class
 * @param color - Color name (yellow, amber, orange)
 * @param shade - Shade number (100, 300, 400, 500, 600)
 * @returns Tailwind class string
 */
export function getBgColorClass(
  color: keyof typeof colorClassMap,
  shade: 100 | 300 | 400 | 500 | 600
): string {
  const colorMap = colorClassMap[color];
  if (!colorMap) return '';
  // Type-safe access: check if shade exists in the color map
  return (colorMap.bg as Record<number, string>)[shade] || '';
}

/**
 * Helper function to get text color class
 * @param color - Color name (yellow, amber, orange)
 * @param shade - Shade number (100, 300, 400, 500, 600)
 * @returns Tailwind class string
 */
export function getTextColorClass(
  color: keyof typeof colorClassMap,
  shade: 100 | 300 | 400 | 500 | 600
): string {
  const colorMap = colorClassMap[color];
  if (!colorMap) return '';
  // Type-safe access: check if shade exists in the color map
  return (colorMap.text as Record<number, string>)[shade] || '';
}

/**
 * Focus ring configuration for consistent accessibility
 */
export const focusRing = {
  /**
   * Standard focus ring - Use for most interactive elements
   * WCAG AA compliant with ring-2 width
   */
  standard: 'focus:outline-none focus:ring-2 focus:ring-amber-400',
  
  /**
   * Focus ring with offset - Use when ring overlaps content
   */
  offset: 'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2',
  
  /**
   * Focus border - Alternative for inputs and form elements
   */
  border: 'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300',
} as const;

export type BrandColors = typeof brandColors;
export type ColorClassMap = typeof colorClassMap;


