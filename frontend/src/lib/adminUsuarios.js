import { supabase } from './supabaseClient'

// Llama a la función de servidor admin-usuarios y devuelve su respuesta, o
// lanza un Error con el mensaje en español que mandó el servidor.
export async function adminUsuarios(accion, datos = {}) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: { accion, ...datos } })
  if (error) {
    let msg = 'No se pudo completar. Revisa tu conexión e intenta de nuevo.'
    try {
      const cuerpo = await error.context?.json?.()
      if (cuerpo?.error) msg = cuerpo.error
    } catch { /* respuesta sin JSON */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
