import type { Config } from "tailwindcss";

/**
 * 設計系統：Minimalism & Swiss Style（ui-ux-pro-max，見 design-system/anvision-erp/MASTER.md）
 * 顏色一律使用語意化 CSS 變數（定義於 globals.css），元件中不寫死色碼。
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v("primary"), hover: v("primary-hover"), soft: v("primary-soft"), on: v("on-primary") },
        accent: { DEFAULT: v("accent"), soft: v("accent-soft") },
        surface: { DEFAULT: v("surface"), muted: v("surface-muted") },
        ink: { DEFAULT: v("ink"), muted: v("ink-muted"), subtle: v("ink-subtle") },
        line: v("line"),
        nav: { DEFAULT: v("nav"), ink: v("nav-ink") },
        danger: { DEFAULT: v("danger"), soft: v("danger-soft") },
        success: { DEFAULT: v("success"), soft: v("success-soft") },
        // 舊類名相容（brand-*）→ 對應到 primary 色階
        brand: { 50: v("primary-soft"), 100: v("primary-soft"), 500: v("secondary"), 600: v("primary"), 700: v("primary-hover"), 900: v("nav") },
      },
      fontFamily: {
        // 英數用 Fira，中文自動回退 Noto Sans TC
        sans: ['"Fira Sans"', '"Noto Sans TC"', "system-ui", "sans-serif"],
        heading: ['"Fira Code"', '"Noto Sans TC"', "ui-monospace", "monospace"],
        mono: ['"Fira Code"', '"Noto Sans TC"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // 字級階層 12 / 14 / 16 / 18 / 24 / 32，最小 12px
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["2rem", { lineHeight: "2.5rem" }],
      },
      zIndex: { nav: "40", overlay: "30", sticky: "20", dropdown: "35" },
      minHeight: { touch: "2.75rem" },
    },
  },
  plugins: [],
} satisfies Config;
