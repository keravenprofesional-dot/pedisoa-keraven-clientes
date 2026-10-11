import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: la app funciona igual en localhost y en GitHub Pages
  // (que la sirve dentro de /<nombre-del-repositorio>/).
  base: './',
  build: {
    rollupOptions: {
      input: {
        // Dos páginas distintas para que cada una se pueda instalar como app
        // aparte: la de las clientas y la del personal.
        clientas: resolve(__dirname, 'index.html'),
        personal: resolve(__dirname, 'personal/index.html'),
      },
      output: {
        // React y Supabase van en archivos aparte porque nunca cambian.
        // Cuando yo arreglo algo del programa, el teléfono de la clienta solo
        // baja el pedacito que cambió; estas dos piezas grandes se quedan
        // guardadas del primer día.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
