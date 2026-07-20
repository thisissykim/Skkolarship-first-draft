import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          50: "#eef2f7",
          100: "#d6e0ec",
          200: "#aec1da",
          300: "#7f9cbe",
          400: "#4d6f96",
          500: "#2d4d70",
          600: "#1c3554",
          700: "#132842",
          800: "#0b1c31",
          900: "#071526",
          950: "#040d19",
        },
        pine: {
          50: "#eafbf3",
          100: "#cdf3e0",
          200: "#9be6c3",
          300: "#63d2a1",
          400: "#34b880",
          500: "#1c9c67",
          600: "#137d52",
          700: "#106243",
          800: "#0f4e37",
          900: "#0d4030",
          950: "#062319",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Pretendard Variable",
          "Segoe UI",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
