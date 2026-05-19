/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'jp-black': '#000000',
        'jp-dark': '#000000',
        'jp-card': '#0A0A0A',
        'jp-card-light': '#121212',
        'jp-orange': '#FF6200',
        'jp-orange-dark': '#CC4E00',
        'jp-orange-light': '#FF8533',
        'jp-gray': '#A0A0A0',
        'jp-gray-light': '#D1D1D1',
        'jp-border': '#1A1A1A',
        'jp-border-light': '#252525',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #000000 0%, #000000 50%, #000000 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FF6200, #CC4E00)',
        'gradient-card': 'linear-gradient(135deg, #0A0A0A, #121212)',
        'gradient-glow': 'radial-gradient(ellipse at center, rgba(255,98,0,0.15) 0%, transparent 70%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-orange': 'pulse-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-orange': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,98,0,0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255,98,0,0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'glow': {
          '0%': { filter: 'drop-shadow(0 0 5px rgba(255,98,0,0.5))' },
          '100%': { filter: 'drop-shadow(0 0 20px rgba(255,98,0,0.8))' },
        }
      },
      boxShadow: {
        'orange': '0 0 20px rgba(255,98,0,0.3)',
        'orange-lg': '0 0 40px rgba(255,98,0,0.4)',
        'card': '0 4px 24px rgba(0,0,0,0.6)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.8)',
      }
    },
  },
  plugins: [],
}
