/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Rustic farmhouse palette
        cream: '#FDF8F3',
        barn: {
          red: '#8B2F2F',
          light: '#A85454',
        },
        forest: {
          DEFAULT: '#2D5A3D',
          light: '#3D7A52',
        },
        earth: {
          50: '#FAF6F1',
          100: '#F0E6D9',
          200: '#E0D0BC',
          300: '#C4A882',
          400: '#A68B5B',
          500: '#8B7355',
          600: '#6B5A45',
          700: '#4A3F30',
          800: '#2E2820',
          900: '#1A1612',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
