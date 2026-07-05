/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',      // Primary Blue
          dark: '#1D4ED8',       // Dark Blue
          light: '#EFF6FF',      // Light Blue Background
        },
        accent: {
          cyan: '#06B6D4',
        },
        dark: {
          DEFAULT: '#0F172A',
        },
        muted: {
          DEFAULT: '#64748B',
        },
        success: {
          DEFAULT: '#16A34A',
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
        border: {
          DEFAULT: '#E2E8F0',
        },
        sidebar: {
          DEFAULT: '#1E3A8A',
          dark: '#182F6E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
