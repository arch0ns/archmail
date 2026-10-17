import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b1220',
          soft: '#111a2e',
          card: '#16213b',
          border: '#22304f',
        },
        brand: {
          DEFAULT: '#4f8cff',
          soft: '#7aa8ff',
          dark: '#3a6fe0',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'radar-ping': {
          '0%': { transform: 'scale(0.6)', opacity: '0.9' },
          '80%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'slide-fade-in': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'radar-ping': 'radar-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        'slide-fade-in': 'slide-fade-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;