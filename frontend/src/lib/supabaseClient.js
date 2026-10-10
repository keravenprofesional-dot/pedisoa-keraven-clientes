import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey, {
  auth: {
    // La sesión queda guardada en el navegador y se renueva sola, para que
    // nadie tenga que volver a entrar cada rato ni al cerrar la pestaña.
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'keraven-pedidos',
  },
})
