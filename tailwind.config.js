/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bt: {
          primary: "#0F2747",
          accent: "#3B82F6",
          background: "#F8FAFC",
          surface: "#FFFFFF",
          "surface-secondary": "#F1F5F9",
          border: "#E2E8F0",
          text: "#0F172A",
          muted: "#64748B",
          success: "#16A34A",
          warning: "#D97706",
          danger: "#DC2626",
          info: "#0EA5E9",
        },
      },
      fontFamily: {
        sans: ["Inter", "Aptos", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      borderRadius: {
        input: "8px",
        card: "12px",
        dialog: "16px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(15 23 42 / 0.04)",
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 10px 24px rgb(15 23 42 / 0.04)",
        dialog: "0 24px 80px rgb(15 23 42 / 0.18)",
      },
      transitionDuration: {
        bt: "150ms",
      },
    },
  },
  plugins: [],
};
