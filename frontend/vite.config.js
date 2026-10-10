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
    },
  },
})
