/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        garden: {
          leaf: "#347a5d",
          coral: "#f4846d",
          cream: "#fffdf7",
        },
      },
    },
  },
  plugins: [],
};
