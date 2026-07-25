/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      borderRadius: {
        control: "0.75rem",
        card: "1rem",
        panel: "1.5rem",
        modal: "1.5rem",
      },

      boxShadow: {
        control:
          "0 1px 2px 0 rgb(15 23 42 / 0.05)",
        card:
          "0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)",
        panel:
          "0 10px 30px -12px rgb(15 23 42 / 0.18)",
        modal:
          "0 24px 60px -16px rgb(15 23 42 / 0.35)",
      },

      spacing: {
        page: "2rem",
        section: "1.5rem",
        card: "1.25rem",
        control: "0.75rem",
      },

      colors: {
        focus: {
          DEFAULT: "rgb(99 102 241)",
          soft: "rgb(99 102 241 / 0.18)",
        },
      },

      transitionDuration: {
        ui: "180ms",
      },

      zIndex: {
        modal: "60",
        toast: "90",
      },
    },
  },

  plugins: [],
};