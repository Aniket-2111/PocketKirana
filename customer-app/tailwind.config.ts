import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../components/**/*.{js,ts,jsx,tsx,mdx}',
    '../app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'secondary-bg': 'var(--secondary-bg)',
        elevated: 'var(--elevated)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        'secondary-foreground': 'var(--secondary-foreground)',
        'disabled-foreground': 'var(--disabled-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        'input-border': 'var(--input-border)',
        'nav-bg': 'var(--nav-bg)',
        'primary-foreground': 'var(--primary-foreground)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
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
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        dialog: 'var(--radius-dialog)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        popover: 'var(--shadow-popover)',
      },
      transitionDuration: {
        quick: '150ms',
        standard: '220ms',
      },
    },
  },
  plugins: [],
};
export default config;
