import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 *
 * V2 design token system is being landed in two phases:
 *   PR-A (this PR): Add new tokens ADDITIVELY alongside legacy. Legacy
 *                   tokens (primary/brand/cta/surface/text/auth-tint)
 *                   keep working unchanged. New tokens (brand-50..900,
 *                   neutral-*, semantic ramps, Shadcn aliases) become
 *                   available for batch 1a downstream.
 *   PR-B (later):   Sweep call sites to v2 tokens, then replace this
 *                   entire `extend` block with `theme: tokens` from
 *                   `./tailwind.tokens.ts`.
 *
 * See: tailwind.tokens.ts (canonical v2 tokens, identical to bundle)
 *      src/styles/index.css (CSS variable definitions in :root + .dark)
 *      docs/ready-set/reports/2026-05-22-design-baseline/ (full context)
 *
 * Legacy color guidance (unchanged):
 * - bg-brand / bg-brand-muted / bg-brand-deep — yellow brand surfaces
 * - bg-cta / bg-cta-hover — interactive yellow surfaces
 * - text-text-primary / text-text-muted / text-text-inverse — text colors
 * - bg-surface / bg-surface-subtle / bg-surface-inverted — backgrounds
 * - bg-auth-tint — auth-page accent surface
 *
 * Spacing tokens (unchanged):
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
        // ─── Legacy tokens (kept as-is for PR-A) ────────────────────
        primary: '#FBD113',
        'custom-yellow': "#ffc61a",
        'dark-navy': '#1a202c',
        'charcoal': '#2d3748',
        brand: {
          DEFAULT: '#FBD113',
          muted: '#F8CC48',
          deep: '#854D0E',
          // V2 ramp added alongside legacy keys above
          50:  "hsl(var(--brand-50) / <alpha-value>)",
          100: "hsl(var(--brand-100) / <alpha-value>)",
          200: "hsl(var(--brand-200) / <alpha-value>)",
          300: "hsl(var(--brand-300) / <alpha-value>)",
          400: "hsl(var(--brand-400) / <alpha-value>)",
          500: "hsl(var(--brand-500) / <alpha-value>)",
          600: "hsl(var(--brand-600) / <alpha-value>)",
          700: "hsl(var(--brand-700) / <alpha-value>)",
          800: "hsl(var(--brand-800) / <alpha-value>)",
          900: "hsl(var(--brand-900) / <alpha-value>)",
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

        // ─── V2 tokens (additive, CSS-variable-backed) ──────────────
        neutral: {
          50:  "hsl(var(--neutral-50) / <alpha-value>)",
          100: "hsl(var(--neutral-100) / <alpha-value>)",
          200: "hsl(var(--neutral-200) / <alpha-value>)",
          300: "hsl(var(--neutral-300) / <alpha-value>)",
          400: "hsl(var(--neutral-400) / <alpha-value>)",
          500: "hsl(var(--neutral-500) / <alpha-value>)",
          600: "hsl(var(--neutral-600) / <alpha-value>)",
          700: "hsl(var(--neutral-700) / <alpha-value>)",
          800: "hsl(var(--neutral-800) / <alpha-value>)",
          900: "hsl(var(--neutral-900) / <alpha-value>)",
        },
        success: {
          50:  "hsl(var(--success-50) / <alpha-value>)",
          100: "hsl(var(--success-100) / <alpha-value>)",
          500: "hsl(var(--success-500) / <alpha-value>)",
          600: "hsl(var(--success-600) / <alpha-value>)",
          700: "hsl(var(--success-700) / <alpha-value>)",
          DEFAULT: "hsl(var(--success-600) / <alpha-value>)",
        },
        warning: {
          50:  "hsl(var(--warning-50) / <alpha-value>)",
          100: "hsl(var(--warning-100) / <alpha-value>)",
          500: "hsl(var(--warning-500) / <alpha-value>)",
          600: "hsl(var(--warning-600) / <alpha-value>)",
          700: "hsl(var(--warning-700) / <alpha-value>)",
          DEFAULT: "hsl(var(--warning-500) / <alpha-value>)",
        },
        error: {
          50:  "hsl(var(--error-50) / <alpha-value>)",
          100: "hsl(var(--error-100) / <alpha-value>)",
          500: "hsl(var(--error-500) / <alpha-value>)",
          600: "hsl(var(--error-600) / <alpha-value>)",
          700: "hsl(var(--error-700) / <alpha-value>)",
          DEFAULT: "hsl(var(--error-500) / <alpha-value>)",
        },
        info: {
          50:  "hsl(var(--info-50) / <alpha-value>)",
          100: "hsl(var(--info-100) / <alpha-value>)",
          500: "hsl(var(--info-500) / <alpha-value>)",
          600: "hsl(var(--info-600) / <alpha-value>)",
          700: "hsl(var(--info-700) / <alpha-value>)",
          DEFAULT: "hsl(var(--info-500) / <alpha-value>)",
        },

        // Shadcn-style semantic aliases (resolve via CSS variables).
        // `--primary` resolves to `--brand-400` = #FBD113 = same color
        // legacy `primary: '#FBD113'` produced. Visual parity preserved.
        background:        "hsl(var(--background) / <alpha-value>)",
        foreground:        "hsl(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT:    "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT:    "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border:  "hsl(var(--border) / <alpha-value>)",
        input:   "hsl(var(--input) / <alpha-value>)",
        ring:    "hsl(var(--ring) / <alpha-value>)",
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
      fontFamily: {
        display: ["var(--font-display)", "Kabel", "Montserrat", "sans-serif"],
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
        // V2 additions (opt-in via new animation names below)
        "fade-in":  { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pop": "pop 0.3s ease-in-out",
        // V2 additions
        "fade-in":  "fade-in 200ms cubic-bezier(0, 0, 0.2, 1)",
        "fade-out": "fade-out 120ms cubic-bezier(0.4, 0, 1, 1)",
        "slide-up": "slide-up 300ms cubic-bezier(0.2, 0, 0, 1)",
        shimmer:    "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [require("tailgrids/plugin")],
};

export default config;