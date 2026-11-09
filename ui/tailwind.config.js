/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F2EC",
        surface: "#FFFEFA",
        "surface-2": "#ECEAE2",
        line: "#DADCD3",
        "line-strong": "#C5C8BD",
        ink: {
          DEFAULT: "#1B2420",
          2: "#5B6762",
          3: "#8B948E",
        },
        copper: {
          DEFAULT: "#B8622F",
          stage: "#E08A55",
        },
        stage: {
          bg: "#0E1419",
          surface: "#141C23",
          card: "#1B2530",
          text: "#E7ECEF",
          "text-2": "#93A1AB",
          line: "rgba(255, 255, 255, 0.08)",
        },
        threat: {
          DEFAULT: "#C8372D",
          stage: "#FF5C50",
        },
        verified: {
          DEFAULT: "#1F8A5F",
          stage: "#3DDC97",
        },
        caution: {
          DEFAULT: "#B7791F",
          stage: "#F2B33D",
        },
        crown: "#E8C872",
      },
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        sans: ["'Geist Sans'", "Inter", "-apple-system", "sans-serif"],
        mono: ["'Geist Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        atelier: "12px",
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(27, 36, 32, 0.06), 0 1px 2px rgba(27, 36, 32, 0.04)",
        card: "0 4px 12px -2px rgba(27, 36, 32, 0.08), 0 2px 6px -1px rgba(27, 36, 32, 0.04)",
        deep: "0 12px 32px -4px rgba(27, 36, 32, 0.12), 0 4px 12px -2px rgba(27, 36, 32, 0.06)",
        stage: "0 8px 30px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
