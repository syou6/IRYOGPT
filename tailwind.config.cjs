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
          /* CSS変数でテーマ切り替え対応 */
          base: 'var(--color-base)',
          surface: 'var(--color-surface)',
          elevated: 'var(--color-elevated)',
          card: 'var(--color-card)',
          stroke: 'var(--color-stroke)',
          accent: 'var(--color-accent)',
          accentDeep: 'var(--color-accent-deep)',
          accentGlow: 'var(--color-accent-glow)',
          text: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          danger: '#EF4444',
          warning: '#F59E0B',
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
        premium: '0 25px 80px rgba(0, 0, 0, 0.08)',
        glow: '0 20px 70px rgba(25, 195, 125, 0.25)',
      },
      borderRadius: {
        '3xl': '28px',
        '4xl': '32px',
        '5xl': '40px',
      },
      backgroundImage: ({ theme }) => ({
        'premium-grid':
          'linear-gradient(135deg, rgba(25,195,125,0.05) 0%, rgba(255,255,255,0) 60%), radial-gradient(circle at top, rgba(25,195,125,0.08), rgba(255,255,255,0) 45%)',
        'premium-radial':
          'radial-gradient(circle at 20% 20%, rgba(25,195,125,0.08), transparent 55%), radial-gradient(circle at 80% 0%, rgba(25,195,125,0.06), transparent 45%)',
      }),
    },
  },
};
