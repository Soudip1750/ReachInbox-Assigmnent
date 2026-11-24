/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        figma: {
          canvas: '#1e1e1e',
          surface: '#ffffff',
          sidebar: '#ffffff',
          muted: '#f9fafb',
          border: '#e5e7eb',
          'border-light': '#f3f4f6',
          text: '#111827',
          'text-secondary': '#4b5563',
          'text-muted': '#9ca3af',
          green: '#00a859',
          'green-hover': '#00924d',
          'green-light': '#e8f5e9',
          'green-border': '#86efac',
          'peach-bg': '#ffedd5',
          'peach-text': '#c2410c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
