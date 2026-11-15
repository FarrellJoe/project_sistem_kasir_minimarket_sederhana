/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4F46E5', hover: '#4338CA', tint: '#EEF2FF', dark: '#3730A3' },
        sidebar: { DEFAULT: '#312E81', hover: '#3E3A9E' },
        accent: '#F59E0B',
        success: '#22C55E',
        danger: { DEFAULT: '#EF4444', dark: '#B91C1C', tint: '#FEF2F2' },
        info: '#3B82F6',
        canvas: '#F8FAFC',
        ink: { DEFAULT: '#1E293B', muted: '#64748B' },
      },
      fontFamily: {
        heading: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.08)',
        dialog: '0 20px 50px rgba(15,23,42,0.22)',
      },
    },
  },
  plugins: [],
};
