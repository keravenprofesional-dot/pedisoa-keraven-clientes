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
        // Los colores de la marca Keraven: dorado sobre negro, como el logo.
        negro: '#0D0D0D',
        carbon: '#1C1A17',
        oro: '#D4A431',
        orosuave: '#EBCB76',
        crema: '#FBF6EA',
        cremaoscura: '#F3EADA',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        // Serif de revista de moda, para los títulos de la tienda.
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
