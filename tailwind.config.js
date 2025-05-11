/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  mode: 'jit',  // JIT 모드 활성화
  theme: {
    extend: {
      colors: {
        bitcoin: "#F7931A",
        positive: "#00BF40",
        negative: "#FF0000",
        surface: {
          DEFAULT: "#FFFFFF",
          container: "#FAFAFA",
          "container-high": "#F5F5F5",
          on: "#242424",
          "on-var": "#999999",
        },
        outline: {
          DEFAULT: "#ADADAD",
          variant: "#EDEDED",
        },
        primary: {
          50: "#f7f0ff",
          100: "#e9d9ff",
          200: "#d4b4ff",
          300: "#b78eff",
          400: "#9c6bff",
          500: "#804aff",
          600: "#6933f5",
          700: "#5626dc",
          800: "#4520b5",
          900: "#361d86",
          950: "#23134f",
          DEFAULT: "#4520b5",
        },
        green: "#34A853",
        dark: {
          light: "#18191c",
          DEFAULT: "#121214",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
