import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f2f5ff", 100: "#e3e9ff", 500: "#4f5bd5", 600: "#3f49b8", 700: "#323a94", 900: "#1b1f4d" },
      },
      fontFamily: { sans: ['"Noto Sans TC"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
