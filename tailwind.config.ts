import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          blue: "#0071e3",
          green: "#34c759",
          yellow: "#f5a623",
          red: "#ff3b30",
          gray: "#86868b",
          lightgray: "#f5f5f7",
          dark: "#1d1d1f",
        },
      },
      borderRadius: {
        "apple": "12px",
        "apple-lg": "16px",
      },
      boxShadow: {
        "apple": "0 2px 12px rgba(0,0,0,0.06)",
        "apple-sm": "0 1px 6px rgba(0,0,0,0.04)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
