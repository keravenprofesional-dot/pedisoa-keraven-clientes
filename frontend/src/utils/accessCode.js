// Ayudas para las entradas.
// Clienta: teléfono + código (el código se puede escribir con o sin guion,
// en mayúsculas o minúsculas). Personal: usuario + teléfono.

export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatCode(code) {
  const c = normalizeCode(code)
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function soloDigitos(value) {
  return String(value || '').replace(/\D/g, '')
}
