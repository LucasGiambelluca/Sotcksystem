/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e11d48', hover: '#be123c', light: '#fff1f2' },
        navy: '#0f172a',
        surface: '#1e293b',
        ink: '#1e293b',
        muted: '#64748b',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
