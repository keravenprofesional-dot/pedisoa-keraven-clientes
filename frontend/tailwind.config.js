/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        petroleo: '#123B4A',
        dorado: '#C9A227',
        graclaro: '#F4F6F7',
        grafondo: '#263238',
        // Pastel de la casa, para que los renglones se despeguen del fondo.
        pastel: '#E7F0F2',
        pastelsuave: '#F2F8F9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
