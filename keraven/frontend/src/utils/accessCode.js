// Helpers para el código de acceso y el login de la clienta.
// La clienta entra con SU TELÉFONO O CORREO + este código como contraseña
// (ver AuthContext.jsx). Debe coincidir con la normalización que usa
// database/functions/create-client/index.ts al crear el usuario.

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatCode(code) {
  const c = normalizeCode(code)
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function normalizePhone(input) {
  const trimmed = String(input || '').trim()
  const digits = trimmed.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

export function isEmail(value) {
  return String(value || '').includes('@')
}
