/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        raycast: {
          bg: '#0F0F11',
          panel: '#17171A',
          border: '#28282E',
          selected: '#232329',
          accent: '#FF6363',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ambientFloat: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.16' },
          '50%': { transform: 'translate3d(36px, -28px, 0) scale(1.08)', opacity: '0.24' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        'fade-in': 'fadeIn 700ms ease-out both',
        'ambient-float': 'ambientFloat 18s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
};
