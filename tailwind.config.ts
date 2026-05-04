import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 *
 * Brand Colors: See src/styles/brand-colors.ts for centralized color system
 * - Primary brand colors: amber-300/400 (use for brand elements)
 * - Semantic colors: yellow-400/500/600 (use for warnings, highlights)
 *
 * Semantic tokens (M3): use these instead of arbitrary hex values.
 * - bg-brand / bg-brand-muted / bg-brand-deep — yellow brand surfaces
 * - bg-cta / bg-cta-hover — interactive yellow surfaces
 * - text-text-primary / text-text-muted / text-text-inverse — text colors
 * - bg-surface / bg-surface-subtle / bg-surface-inverted — backgrounds
 * - bg-auth-tint — auth-page accent surface
 *
 * Spacing tokens (M3): named replacements for common arbitrary px values.
 * - pt-page-y / -lg / -xl / -2xl — section vertical rhythm
 * - h-card-h / -md / -lg, min-h-card-h-sm — card height constraints
 * - w-card-min — card width baseline
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FBD113',
        'custom-yellow': "#ffc61a",
        'dark-navy': '#1a202c',
        'charcoal': '#2d3748',
        brand: {
          DEFAULT: '#FBD113',
          muted: '#F8CC48',
          deep: '#854D0E',
        },
        cta: {
          DEFAULT: '#FBD113',
          hover: '#FFC61A',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB',
          inverted: '#1A1A1A',
        },
        text: {
          primary: '#1A1A1A',
          muted: '#4B5563',
          inverse: '#FFFFFF',
        },
        'auth-tint': '#F4F7FF',
      },
      spacing: {
        'page-y-sm': '100px',
        'page-y': '120px',
        'page-y-lg': '140px',
        'page-y-xl': '160px',
        'page-y-2xl': '180px',
        'card-min': '300px',
        'card-h-sm': '200px',
        'card-h': '300px',
        'card-h-md': '400px',
        'card-h-lg': '500px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1.1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pop": "pop 0.3s ease-in-out",
      },
    },
  },
  plugins: [require("tailgrids/plugin")],
};

export default config;