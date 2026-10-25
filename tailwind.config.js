/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FDFBF7', // warm cream canvas
        cream: {
          DEFAULT: '#FFFDF9',
          soft: '#F8F1E3',
          dark: '#EADEC8',
        },
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1B1F23',
          soft: '#5B6670',
        },
        line: '#EADEC8',
        brand: {
          DEFAULT: '#2563EB',
          soft: '#EAF1FF',
          dark: '#1D4ED8',
        },
        // Dedicated Red, Orange, Green palettes
        red: {
          DEFAULT: '#DC2626',
          soft: '#FEE2E2',
          dark: '#991B1B',
          vibrant: '#EF4444',
        },
        orange: {
          DEFAULT: '#EA580C',
          soft: '#FFEDD5',
          dark: '#C2410C',
          vibrant: '#F97316',
        },
        green: {
          DEFAULT: '#16A34A',
          soft: '#DCFCE7',
          dark: '#15803D',
          vibrant: '#22C55E',
        },
        safe: {
          DEFAULT: '#16A34A',
          soft: '#DCFCE7',
        },
        caution: {
          DEFAULT: '#EA580C',
          soft: '#FFEDD5',
        },
        scam: {
          DEFAULT: '#DC2626',
          soft: '#FEE2E2',
        },
      },
      borderRadius: {
        'lg': '24px',
        'md': '16px',
      },
      boxShadow: {
        'soft': '0 6px 24px rgba(45, 30, 15, 0.06)',
        'float': '0 12px 32px rgba(45, 30, 15, 0.10)',
        'colorful': '0 8px 24px rgba(234, 88, 12, 0.20)',
        'green': '0 8px 24px rgba(22, 163, 74, 0.20)',
        'red': '0 8px 24px rgba(220, 38, 38, 0.20)',
      },
      fontSize: {
        'body': ['1.25rem', { lineHeight: '1.5' }], // 20px min
        'title': ['1.75rem', { lineHeight: '1.3' }], // 28px
        'verdict': ['2rem', { lineHeight: '1.2' }], // 32px
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans Tamil', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
