/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0d1117",
        surface: "#161b22",
        elevated: "#21262d",
        border: "#30363d",
        muted: "#8b949e",
        body: "#c9d1d9",
        heading: "#f0f6fc",
        accent: "#58a6ff",
        success: "#3fb950",
        warning: "#d29922",
        danger: "#f85149"
      },
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"]
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px"
      }
    }
  },
  plugins: []
};
