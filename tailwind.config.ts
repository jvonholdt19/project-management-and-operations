import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  // Project colors are data-driven, so keep these classes from being purged.
  safelist: [
    { pattern: /(bg|text|ring)-(indigo|emerald|amber|rose|sky|violet|teal)-(100|500|700)/ },
  ],
  plugins: [],
} satisfies Config;
