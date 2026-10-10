// Códigos cortos "hablados" para los productos: TIPO-SABOR-TAMAÑO.
// Ejemplos:  SH-BAN-32 = Shampoo de Banana 32 oz
//            TR-COC-10 = Tratamiento de Coco 10 oz
//            GO-BRI-4  = Gotica de Brillo 4 oz
// La idea es poder decirlo por teléfono y que se entienda sin mirar la lista.

// Lo primero del nombre: qué clase de producto es.
const TIPOS = [
  ['TRATAMIENTO', 'TR'], ['MASCARILLA', 'MA'], ['SHAMPOO', 'SH'], ['CHAMPU', 'SH'],
  ['ACONDICIONADOR', 'AC'], ['BALSAMO', 'BA'], ['ESCULTOR', 'ES'], ['SPRAY', 'SP'],
  ['GOTERO', 'GO'], ['GOTICA', 'GO'], ['GOTITA', 'GO'], ['LEAVE IN', 'LE'], ['LEAVEIN', 'LE'],
  ['LEAVEN', 'LE'], ['LEAVE', 'LE'], ['LACEADOR', 'LA'], ['GRASITA', 'GR'], ['GEL', 'GE'],
  ['CIRUGIA', 'CI'], ['CELULAS', 'CE'], ['CELULA', 'CE'], ['LINEA', 'LIN'], ['KIT', 'KIT'],
  ['CREMA', 'CR'], ['ACEITE', 'AE'], ['SERUM', 'SE'], ['TINTE', 'TI'], ['KERATINA', 'KE'],
]

// Lo que lo distingue de sus hermanos: el sabor, la línea o el uso.
const SABORES = [
  ['MIEL Y LECHE', 'MIE'], ['JENGIBRE Y ROMERO', 'JEN'], ['GOLDEN BLACK', 'GOL'],
  ['DETOX NEGRO', 'DET'], ['MIEL', 'MIE'], ['JENGIBRE', 'JEN'], ['ROMERO', 'ROM'],
  ['DETOX', 'DET'], ['ZANAHORIA', 'ZAN'], ['BANANA', 'BAN'], ['CACAO', 'CAC'], ['COCO', 'COC'],
  ['CRECIMIENTO', 'CRE'], ['BRILLO', 'BRI'], ['MOLDEADORA', 'MOL'], ['INTIMO', 'INT'],
  ['CAPILAR', 'CAP'], ['CURATIVA', 'CUR'], ['MADRE', 'MAD'], ['GOLDEN', 'GOL'],
  // "RISOZ" y "ROZOS" aparecen escritos así en listas viejas: cuentan como rizos.
  ['RIZOS', 'RIZ'], ['RIZO', 'RIZ'], ['RISOZ', 'RIZ'], ['ROZOS', 'RIZ'], ['RISOS', 'RIZ'],
]

// Quita tildes y deja todo en mayúsculas para comparar sin sorpresas.
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

export function generarCodigo(nombre) {
  const n = normalizar(nombre)
  if (!n) return ''

  const tipo = TIPOS.find(([palabra]) => n.includes(palabra))?.[1]
  const sabor = SABORES.find(([palabra]) => n.includes(palabra))?.[1]
  // El tamaño: el último número seguido de OZ (el "0Z" mal escrito también).
  const tamanos = [...n.matchAll(/(\d+)\s*(?:OZ|0Z)\b/g)].map((m) => m[1])
  const tamano = tamanos[tamanos.length - 1]

  const partes = [tipo, sabor, tamano].filter(Boolean)
  if (partes.length) return partes.join('-')

  // Si el nombre no se parece a nada conocido: las primeras letras de sus
  // dos primeras palabras (ej. "POLVO AZUL" → PO-AZU).
  const palabras = n.replace(/[^A-Z0-9 ]/g, '').split(' ').filter((p) => p.length > 2 && p !== 'DEL' && p !== 'LOS' && p !== 'LAS')
  return [palabras[0]?.slice(0, 2), palabras[1]?.slice(0, 3)].filter(Boolean).join('-') || 'PR'
}

// Igual que generarCodigo pero garantizando que no se repita.
// `usados` es un Set de códigos ya ocupados (en MAYÚSCULAS).
export function codigoUnico(nombre, usados) {
  const base = generarCodigo(nombre)
  let codigo = base
  let n = 2
  while (usados.has(codigo.toUpperCase())) codigo = `${base}-${n++}`
  usados.add(codigo.toUpperCase())
  return codigo
}
