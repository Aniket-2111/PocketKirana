import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#006e2f",
        "primary-container": "#22c55e",
        "on-primary": "#ffffff",
        "on-primary-container": "#004b1e",

        secondary: "#416900",
        "secondary-container": "#acf847",

        tertiary: "#855300",
        "tertiary-container": "#ef9900",

        surface: "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e6eeff",
        "surface-container-high": "#dee9fc",
        "surface-container-highest": "#d9e3f6",

        "on-surface": "#121c2a",
        "on-surface-variant": "#3d4a3d",
        outline: "#6d7b6c",
        "outline-variant": "#bccbb9",

        brand: {
          green: "#006E2F",
          darkGreen: "#004B1E",
          lightGreen: "#DCFCE7",
          orange: "#F97316",
          yellow: "#FACC15",
          blue: "#38BDF8",
          red: "#EF4444",
        },
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1rem',
        btn: "16px",
        card: "24px",
        input: "12px",
        modal: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.08)",
        cardHover: "0 8px 24px rgba(0, 0, 0, 0.12)",
        dropdown: "0 4px 16px rgba(0, 0, 0, 0.12)",
        modal: "0 12px 36px rgba(0, 0, 0, 0.2)",
        soft: "0px 4px 20px rgba(0, 0, 0, 0.05)",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
