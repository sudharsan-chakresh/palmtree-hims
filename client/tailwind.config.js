export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#003870',      // Palmtree Deep Blue
          accent: '#0056A3',    // Palmtree Primary Blue
          sky: '#4CAF50',       // Palmtree Green Accent
          teal: '#2E8B57',      // Palmtree Secondary Green
          slate: '#0F172A',     // Midnight Navy
        },
        neutral: {
          light: '#F3F4F6',     // Cloud Gray
        }
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        ui: ['Open Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
