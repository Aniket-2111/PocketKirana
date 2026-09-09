import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../components/**/*.{js,ts,jsx,tsx,mdx}',
    '../app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          50: '#eefbf3',
          100: '#d7f6e3',
          200: '#b2ebca',
          300: '#7edca9',
          400: '#45c483',
          500: '#006E2F',
          600: '#006E2F',
          700: '#158349',
          800: '#14673c',
          900: '#125433',
        },
      },
    },
  },
  plugins: [],
};
export default config;
