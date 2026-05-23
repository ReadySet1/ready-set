/**
 * Ready Set — Tailwind tokens (v2)
 * Drop-in extend block. Wired to CSS variables defined in src/styles/index.css.
 *
 * Status: ADDITIVE in the foundation PR — these tokens coexist alongside the
 * legacy `primary`/`brand`/`cta`/`surface`/`text`/`auth-tint` tokens defined
 * in tailwind.config.ts. The sweep PR (PR-B) will replace tailwind.config.ts's
 * extend block entirely with `theme: tokens`.
 *
 * Shadcn `components.json` must set `cssVariables: true`.
 */
import type { Config } from "tailwindcss";

export const tokens: Config["theme"] = {
  extend: {
    // ─── Colors (CSS variable-backed for light/dark) ─────────────
    colors: {
      // Brand ramp
      brand: {
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
        DEFAULT: "hsl(var(--brand-400) / <alpha-value>)",
      },

      // Neutrals — replace slate
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

      // Semantic (status)
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

      // Shadcn-style semantic aliases (resolve via globals.css)
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
      primary: {
        DEFAULT:    "hsl(var(--primary) / <alpha-value>)",
        foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        hover:      "hsl(var(--primary-hover) / <alpha-value>)",
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

    // ─── Type ─────────────────────────────────────────────────────
    fontFamily: {
      sans:    ["var(--font-sans)",    "Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
      display: ["var(--font-display)", "Kabel",      "Montserrat",    "sans-serif"],
      mono:    ["var(--font-mono)",    "JetBrains Mono", "ui-monospace", "monospace"],
    },

    fontSize: {
      // [size, { lineHeight, letterSpacing }]
      xs:   ["0.75rem",  { lineHeight: "1.5",  letterSpacing: "0em" }],
      sm:   ["0.875rem", { lineHeight: "1.5",  letterSpacing: "0em" }],
      base: ["1rem",     { lineHeight: "1.6",  letterSpacing: "0em" }],
      lg:   ["1.125rem", { lineHeight: "1.55", letterSpacing: "-0.005em" }],
      xl:   ["1.25rem",  { lineHeight: "1.4",  letterSpacing: "-0.01em" }],
      "2xl":["1.5rem",   { lineHeight: "1.35", letterSpacing: "-0.01em" }],
      "3xl":["1.875rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
      "4xl":["2.25rem",  { lineHeight: "1.2",  letterSpacing: "-0.02em" }],
      "5xl":["3rem",     { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
      "6xl":["3.75rem",  { lineHeight: "1.05", letterSpacing: "-0.022em" }],
      "7xl":["4.5rem",   { lineHeight: "1",    letterSpacing: "-0.025em" }],
    },

    fontWeight: {
      light: "300", regular: "400", medium: "500",
      semibold: "600", bold: "700", extrabold: "800", black: "900",
    },

    letterSpacing: {
      tighter: "-0.02em",
      tight:   "-0.01em",
      normal:  "0em",
      wide:    "0.025em",
      wider:   "0.04em",
      widest:  "0.1em",
    },

    // ─── Spacing ──────────────────────────────────────────────────
    spacing: {
      "page-y-sm":  "6.25rem",
      "page-y":     "7.5rem",
      "page-y-lg":  "8.75rem",
      "page-y-xl":  "10rem",
      "page-y-2xl": "11.25rem",
      "card-min":   "18.75rem",
      "card-h-sm":  "12.5rem",
      "card-h":     "18.75rem",
      "card-h-md":  "25rem",
      "card-h-lg":  "31.25rem",
    },

    // ─── Radius ───────────────────────────────────────────────────
    borderRadius: {
      none: "0",
      xs:   "0.125rem",
      sm:   "0.25rem",
      md:   "0.375rem",
      lg:   "0.5rem",
      xl:   "0.75rem",
      "2xl":"1rem",
      "3xl":"1.5rem",
      full: "9999px",
    },

    // ─── Shadows / elevation ─────────────────────────────────────
    boxShadow: {
      xs:  "0 1px 2px 0 rgba(19, 19, 16, 0.05)",
      sm:  "0 1px 3px 0 rgba(19, 19, 16, 0.08), 0 1px 2px -1px rgba(19, 19, 16, 0.04)",
      md:  "0 4px 8px -2px rgba(19, 19, 16, 0.08), 0 2px 4px -2px rgba(19, 19, 16, 0.04)",
      lg:  "0 12px 20px -4px rgba(19, 19, 16, 0.10), 0 4px 8px -4px rgba(19, 19, 16, 0.04)",
      xl:  "0 24px 40px -8px rgba(19, 19, 16, 0.14), 0 8px 16px -8px rgba(19, 19, 16, 0.06)",
      "2xl": "0 40px 80px -16px rgba(19, 19, 16, 0.20)",
      inner: "inset 0 1px 2px 0 rgba(19, 19, 16, 0.06)",
      "focus-ring": "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))",
      none: "none",
    },

    // ─── Motion ───────────────────────────────────────────────────
    transitionDuration: {
      fast:    "120ms",
      DEFAULT: "200ms",
      base:    "200ms",
      medium:  "300ms",
      slow:    "500ms",
      slower:  "750ms",
    },
    transitionTimingFunction: {
      standard:   "cubic-bezier(0.2, 0, 0, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      spring:     "cubic-bezier(0.5, 1.5, 0.6, 1)",
      DEFAULT:    "cubic-bezier(0.2, 0, 0, 1)",
    },

    // ─── Keyframes / animations ──────────────────────────────────
    keyframes: {
      "accordion-down": {
        from: { height: "0" },
        to: { height: "var(--radix-accordion-content-height)" },
      },
      "accordion-up": {
        from: { height: "var(--radix-accordion-content-height)" },
        to: { height: "0" },
      },
      pop: {
        "0%":   { transform: "scale(1)" },
        "50%":  { transform: "scale(1.15)" },
        "100%": { transform: "scale(1.1)" },
      },
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
      "accordion-down": "accordion-down 200ms cubic-bezier(0.2, 0, 0, 1)",
      "accordion-up":   "accordion-up 200ms cubic-bezier(0.2, 0, 0, 1)",
      pop:              "pop 300ms cubic-bezier(0.5, 1.5, 0.6, 1)",
      "fade-in":        "fade-in 200ms cubic-bezier(0, 0, 0.2, 1)",
      "fade-out":       "fade-out 120ms cubic-bezier(0.4, 0, 1, 1)",
      "slide-up":       "slide-up 300ms cubic-bezier(0.2, 0, 0, 1)",
      shimmer:          "shimmer 1.6s linear infinite",
    },
  },
};

export default tokens;
