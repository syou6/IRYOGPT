/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          base: '#040607',
          surface: '#0B1410',
          elevated: '#131F1A',
          card: 'rgba(11, 20, 16, 0.82)',
          stroke: '#1F2A23',
          accent: '#19C37D',
          accentDeep: '#0F8A5F',
          accentGlow: '#7AF4C1',
          text: '#F5F7F4',
          muted: '#8BA39B',
          danger: '#FF5A5F',
          warning: '#F3B664',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Söhne',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        premium: '0 35px 120px rgba(1, 8, 4, 0.65)',
        glow: '0 20px 70px rgba(25, 195, 125, 0.35)',
      },
      borderRadius: {
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },
      backgroundImage: ({ theme }) => ({
        'premium-grid':
          'linear-gradient(135deg, rgba(25,195,125,0.08) 0%, rgba(4,6,7,0) 60%), radial-gradient(circle at top, rgba(122,244,193,0.15), rgba(4,6,7,0) 45%)',
        'premium-radial':
          'radial-gradient(circle at 20% 20%, rgba(122,244,193,0.2), transparent 55%), radial-gradient(circle at 80% 0%, rgba(25,195,125,0.15), transparent 45%)',
      }),
    },
  },
};
