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
          DEFAULT: '#6C63FF',
          dark: '#5A50E8',
          light: '#F5F6FF',
        },
        accent: {
          cyan: '#9B8CFF',
        },
        dark: {
          DEFAULT: '#0F172A',
        },
        muted: {
          DEFAULT: '#666666',
        },
        success: {
          DEFAULT: '#22C55E',
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        danger: {
          DEFAULT: '#EF4444',      // Soft Rose
        },
        border: {
          DEFAULT: '#ECECEC',
        },
        sidebar: {
          DEFAULT: '#FFFFFF',
          dark: '#F5F6FF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 30px rgba(0, 0, 0, 0.06)',
        diffusion: '0 24px 60px rgba(108, 99, 255, 0.10)',
      }
    },
  },
  plugins: [],
}
