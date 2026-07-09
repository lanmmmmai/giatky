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
          DEFAULT: '#2563EB',      // Premium Electric Blue
          dark: '#1D4ED8',       // Dark Blue
          light: '#F8FAFC',      // Light Blue-Grey Background
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
          DEFAULT: '#10B981',      // Desaturated Emerald
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        danger: {
          DEFAULT: '#EF4444',      // Soft Rose
        },
        border: {
          DEFAULT: '#E2E8F0',
        },
        sidebar: {
          DEFAULT: '#0F172A',      // Slate-900 (instead of raw blue)
          dark: '#020617',         // Slate-950
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 30px -10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        diffusion: '0 20px 40px -15px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [],
}
