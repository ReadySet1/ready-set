import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 * 
 * Brand Colors: See src/styles/brand-colors.ts for centralized color system
 * - Primary brand colors: amber-300/400 (use for brand elements)
 * - Semantic colors: yellow-400/500/600 (use for warnings, highlights)
 * 
 * Note: Tailwind includes amber and yellow color palettes by default.
 * Dynamic class names are avoided - use colorClassMap from brand-colors.ts instead.
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