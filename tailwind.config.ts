import type { Config } from "tailwindcss";

/**
 * Design tokens. The slate scale + surfaces are CSS variables so every
 * existing `text-slate-*` / `bg-surface` class is automatically dark-mode
 * aware — components never branch on theme.
 */
function v(name: string) {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50: v("slate-50"),
          100: v("slate-100"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
          900: v("slate-900"),
        },
        surface: v("surface"),
        app: v("app-bg"),
        primary: {
          DEFAULT: "#3730A3", // deep indigo — swap to #393185 for Ashapura Marinetech
          hover: "#312A8C",
          soft: v("primary-soft"),
        },
        accent: "#1675BF",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        info: "#0EA5E9",
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        overlay: "0 10px 30px -5px rgb(0 0 0 / 0.25)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
