import tailwindcssAnimate from 'tailwindcss-animate';

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
          DEFAULT: '#111111',
          dark: '#2A2A2A',
          light: '#F5F5F5',
        },
        secondary: {
          DEFAULT: '#525252',
        },
        accent: {
          cyan: '#737373',
        },
        dark: {
          DEFAULT: '#171717',
        },
        muted: {
          DEFAULT: '#6B7280',
        },
        success: {
          DEFAULT: '#16A34A',
        },
        warning: {
          DEFAULT: '#D97706',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
        border: {
          DEFAULT: '#E5E7EB',
        },
        sidebar: {
          DEFAULT: '#111111',
          dark: '#181818',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(0, 0, 0, 0.05)',
        diffusion: '0 20px 50px rgba(0, 0, 0, 0.10)',
      }
    },
  },
  plugins: [tailwindcssAnimate],
}
