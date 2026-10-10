import { supabase } from '../lib/supabaseClient'

const LADO_MAXIMO = 1000 // píxeles
const CALIDAD = 0.82

// Achica la foto antes de subirla: una foto de celular pesa 3 o 4 MB y así
// queda en unos 100 KB. Carga rápido para el cliente y gasta menos datos.
async function achicar(archivo) {
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  const ctx = lienzo.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  imagen.close?.()
  const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', CALIDAD))
  if (!blob) throw new Error('No se pudo preparar la foto')
  return blob
}

// Sube la foto y devuelve su dirección pública.
export async function subirFoto(archivo, carpeta = 'productos') {
  if (!archivo.type.startsWith('image/')) throw new Error('Ese archivo no es una foto')
  if (archivo.size > 25 * 1024 * 1024) throw new Error('Esa foto es demasiado grande')

  const blob = await achicar(archivo)
  const nombre = `${carpeta}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('fotos').upload(nombre, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) {
    throw new Error(/row-level security|not authorized/i.test(error.message)
      ? 'No tienes permiso para subir fotos'
      : 'No se pudo subir la foto. Revisa tu conexión.')
  }
  return supabase.storage.from('fotos').getPublicUrl(nombre).data.publicUrl
}

// Borra una foto que ya no se usa (si falla, no pasa nada grave).
export async function borrarFoto(url) {
  const ruta = String(url || '').split('/fotos/')[1]
  if (!ruta) return
  await supabase.storage.from('fotos').remove([ruta]).catch(() => {})
}
