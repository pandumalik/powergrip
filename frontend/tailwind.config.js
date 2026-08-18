/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        dark: {
          bg: '#0B0F17',
          card: '#111827',
          surface: '#1F2937',
          border: '#374151',
          accent: '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
