// Sugiere qué producto del ERP es cada producto de Pedidos, comparando los
// nombres (los códigos de los dos programas no se parecen).
//
// Se parte cada nombre en: QUÉ es (shampoo, mascarilla…), DE QUÉ (coco,
// cacao…) y CUÁNTO (10 oz, 32 oz). Solo se sugiere cuando hay UNA pareja que
// coincide en las tres cosas. Dos casos quedan "por confirmar" (los decide el
// dueño, no la computadora):
//   · En el ERP no existe "Tratamiento": se busca como "Mascarilla".
//   · El producto del ERP no dice tamaño (ej. "SHAMPOO GOLDEN BLACK").

const quitarAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Palabras que no dicen nada para comparar
const RELLENO = new Set(['de', 'del', 'y', 'la', 'el', 'in', 'linea', 'oz', 'z'])
// Mismo significado escrito distinto
const IGUAL = { risoz: 'rizos', rizo: 'rizos', jenjibre: 'jengibre', romero: '', negro: '', leche: '', miel: 'golden', black: '', leave: 'leaven', crecimiento: '', brillo: '' }

export function partes(nombre) {
  let t = quitarAcentos(nombre).replace(/(\d+)\s*[o0]\s*z\b/g, ' $1oz ').replace(/[^a-z0-9 ]/g, ' ')
  const tam = (t.match(/\b(\d+)oz\b/) || [])[1] || null
  t = t.replace(/\b\d+oz\b/g, ' ')
  const palabras = t.split(/\s+/).filter(Boolean)
    .map((w) => (w in IGUAL ? IGUAL[w] : w))
    .filter((w) => w && !RELLENO.has(w) && !/^\d+$/.test(w))
  let tipo = palabras[0] || ''
  let cambiado = false
  if (tipo === 'tratamiento') { tipo = 'mascarilla'; cambiado = true }
  return { tipo, resto: new Set(palabras.slice(1)), tam, cambiado }
}

// Devuelve { producto_id, dudosa, motivo } o null
export function sugerir(nombrePedidos, listaErp) {
  const p = partes(nombrePedidos)
  const candidatos = []
  for (const e of listaErp) {
    const q = partes(e.nombre)
    if (!q.tipo || q.tipo !== p.tipo) continue
    if (q.tam && p.tam && q.tam !== p.tam) continue
    if (q.tam && !p.tam) continue
    // Todo lo que dice el del ERP (sabor, línea) tiene que estar en el de Pedidos, y al revés
    const iguales = [...q.resto].every((w) => p.resto.has(w)) && [...p.resto].every((w) => q.resto.has(w))
    if (!iguales) continue
    candidatos.push({ e, sinTam: !q.tam && !!p.tam })
  }
  if (candidatos.length !== 1) return null
  const { e, sinTam } = candidatos[0]
  const motivos = []
  if (p.cambiado) motivos.push('en el ERP se llama Mascarilla')
  if (sinTam) motivos.push('en el ERP no dice el tamaño')
  return { producto_id: e.id, dudosa: motivos.length > 0, motivo: motivos.join(' y ') }
}
