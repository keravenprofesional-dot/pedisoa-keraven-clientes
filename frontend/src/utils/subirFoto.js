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

// Borra una foto (o un video de promoción) que ya no se usa. Si falla, no
// pasa nada grave.
export async function borrarFoto(url) {
  const m = String(url || '').match(/\/object\/public\/(fotos|promos)\/(.+)$/)
  if (!m) return
  await supabase.storage.from(m[1]).remove([m[2]]).catch(() => {})
}

export const VIDEO_MB = 50
export const VIDEO_SEGUNDOS = 60
export const esVideo = (url) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(url || ''))

function duracion(archivo) {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration) }
    v.onerror = () => resolve(0)
    v.src = URL.createObjectURL(archivo)
  })
}

// Sube un video corto de promoción (va tal cual, sin achicar) y devuelve su
// dirección pública.
// Algunos teléfonos (y Windows con los .mov) no dicen de qué tipo es el
// archivo: entonces se reconoce por su terminación.
const TIPO_POR_EXT = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', qt: 'video/quicktime' }
function tipoDeVideo(archivo) {
  const t = String(archivo.type || '').toLowerCase()
  if (t === 'video/mp4' || t === 'video/webm' || t === 'video/quicktime') return t
  if (t === 'video/x-m4v') return 'video/mp4'
  const ext = String(archivo.name || '').toLowerCase().split('.').pop()
  return TIPO_POR_EXT[ext] || null
}
const mb = (n) => (n / 1024 / 1024).toFixed(1).replace('.0', '')

export async function subirVideo(archivo) {
  const tipo = tipoDeVideo(archivo)
  if (!tipo) throw new Error(`ese archivo no es un video MP4, WEBM o MOV (es "${archivo.type || archivo.name.split('.').pop() || 'desconocido'}")`)
  if (archivo.size > VIDEO_MB * 1024 * 1024) throw new Error(`pesa ${mb(archivo.size)} MB y el máximo es ${VIDEO_MB} MB. Recórtalo o envíalo por WhatsApp a ti mismo para que se achique, y súbelo de nuevo`)
  const seg = await duracion(archivo)
  if (seg > VIDEO_SEGUNDOS + 0.5) throw new Error(`dura ${Math.round(seg)} segundos y el máximo es ${VIDEO_SEGUNDOS}. Recórtalo y súbelo de nuevo`)

  const ext = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[tipo]
  const nombre = `videos/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('promos').upload(nombre, archivo, {
    contentType: tipo,
    cacheControl: '31536000',
  })
  if (error) {
    const m = String(error.message || '')
    throw new Error(/row-level security|not authorized|unauthorized/i.test(m) ? 'no tienes permiso para subir videos'
      : /size|too large|exceed/i.test(m) ? `la nube no acepta videos de más de ${VIDEO_MB} MB`
      : /mime|type/i.test(m) ? 'la nube no acepta ese formato de video (usa MP4)'
      : `no se pudo subir (${m || 'se cortó la conexión'}). Si tu internet está lento, prueba con un video más corto`)
  }
  return supabase.storage.from('promos').getPublicUrl(nombre).data.publicUrl
}
