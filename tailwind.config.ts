import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0a66c2",
          dark: "#004182",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
