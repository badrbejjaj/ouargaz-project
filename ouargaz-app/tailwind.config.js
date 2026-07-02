/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/context/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TotalEnergies Brand Colors
        total: {
          red: '#DA1A1A',
          orange: '#F5A623',
          blue: '#0066CC',
          50: '#FFF5F5',
          100: '#FFE0E0',
          500: '#DA1A1A',
          600: '#C01515',
          700: '#A01010',
        },
        energy: {
          orange: '#FF6B00',
          amber: '#FFAA00',
          yellow: '#FFD700',
        },
        // Dark industrial theme
        dark: {
          900: '#05080F',
          800: '#0A0E1A',
          700: '#0F1629',
          600: '#141C35',
          500: '#1A2344',
          400: '#1E2A52',
          300: '#243060',
        },
        // Card and surface colors
        surface: {
          dark: '#111827',
          card: '#1A2234',
          border: 'rgba(255,255,255,0.08)',
        },
        // Status colors
        status: {
          green: '#00D97E',
          red: '#FF3B3B',
          orange: '#FF6B00',
          blue: '#0066CC',
          yellow: '#FFAA00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-energy': 'linear-gradient(135deg, #DA1A1A 0%, #FF6B00 50%, #FFAA00 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0A0E1A 0%, #141C35 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(26,34,52,0.9) 0%, rgba(15,22,41,0.9) 100%)',
      },
      boxShadow: {
        'energy': '0 0 30px rgba(218,26,26,0.3), 0 0 60px rgba(255,107,0,0.1)',
        'card': '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
        'glow-red': '0 0 20px rgba(218,26,26,0.5)',
        'glow-orange': '0 0 20px rgba(255,107,0,0.5)',
        'glow-blue': '0 0 20px rgba(0,102,204,0.5)',
        'glow-green': '0 0 20px rgba(0,217,126,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(218,26,26,0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(218,26,26,0.8), 0 0 60px rgba(255,107,0,0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
