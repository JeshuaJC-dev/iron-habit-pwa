/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderColor: {
        DEFAULT: 'transparent',
      },
      colors: {
        apple: {
          bg: "#000000",
          card: "#121215",
          cardElevated: "#18181d",
          cardHover: "#202028",
          border: "transparent",
          borderHover: "rgba(225, 29, 72, 0.35)",
          textPrimary: "#f5f5f7",
          textSecondary: "#8e8e98",
          textTertiary: "#6e6e78",
          blue: "#2997ff",
          blueHover: "#0077ed",
          titanium: "#e3e3e8",
          red: "#e11d48",       // Viltrum Crimson
          orange: "#ff9f0a",
          green: "#30d158",
          purple: "#bf5af2",
        },
        viltrum: {
          crimson: "#e11d48",     // Blood / Imperial Red
          crimsonDark: "#9f1239",
          crimsonGlow: "rgba(225, 29, 72, 0.55)",
          white: "#f8fafc",       // Imperial Pure White
          gold: "#eab308",        // Thragg Imperial Crown / Medallion Gold
          goldGlow: "rgba(234, 179, 8, 0.4)",
          slate: "#0b0b0e",       // Dark Space
          armor: "#16161c",
          armorBorder: "rgba(225, 29, 72, 0.22)",
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace"
        ]
      },
      borderRadius: {
        'apple-sm': '12px',
        'apple-md': '18px',
        'apple-card': '28px',
        'apple-hero': '34px',
        'apple-pill': '9999px',
      },
      boxShadow: {
        'apple-glow': '0 0 50px -10px rgba(41, 151, 255, 0.25)',
        'apple-red-glow': '0 0 50px -10px rgba(225, 29, 72, 0.45)',
        'viltrum-pulse': '0 0 35px rgba(225, 29, 72, 0.4), inset 0 0 15px rgba(225, 29, 72, 0.2)',
        'viltrum-gold': '0 0 25px rgba(234, 179, 8, 0.35)',
        'apple-card': '0 20px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'apple-inner': 'inset 0 1px 1px rgba(255, 255, 255, 0.1), inset 0 -1px 1px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
