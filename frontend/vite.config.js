import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: la app funciona igual en localhost y en GitHub Pages
  // (que la sirve dentro de /<nombre-del-repositorio>/).
  base: './',
})
