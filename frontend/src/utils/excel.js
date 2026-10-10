// Lee y escribe archivos .xlsx sin ninguna librería externa.
//
// Un .xlsx es un ZIP con archivos XML adentro. El navegador ya trae todo lo
// necesario para abrirlo (DecompressionStream), así que no hay que descargar
// nada: la app pesa igual y funciona sin internet rápido.

const td = new TextDecoder()
const te = new TextEncoder()
const u16 = (d, p) => d.getUint16(p, true)
const u32 = (d, p) => d.getUint32(p, true)

// ───────── ZIP: leer ─────────

function abrirZip(buffer) {
  const b = new Uint8Array(buffer)
  const d = new DataView(buffer)
  // El índice del ZIP va al final del archivo; se busca hacia atrás.
  let fin = -1
  for (let i = b.length - 22; i >= 0 && i > b.length - 22 - 65536; i--) {
    if (u32(d, i) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) throw new Error('El archivo no parece un Excel (.xlsx) válido.')
  const cuantos = u16(d, fin + 10)
  let p = u32(d, fin + 16)
  const archivos = {}
  for (let i = 0; i < cuantos; i++) {
    if (u32(d, p) !== 0x02014b50) break
    const metodo = u16(d, p + 10)
    const comprimido = u32(d, p + 20)
    const nLen = u16(d, p + 28), eLen = u16(d, p + 30), cLen = u16(d, p + 32)
    const offset = u32(d, p + 42)
    const nombre = td.decode(b.subarray(p + 46, p + 46 + nLen))
    archivos[nombre] = { metodo, comprimido, offset }
    p += 46 + nLen + eLen + cLen
  }
  return { b, d, archivos }
}

async function leerDelZip(zip, nombre) {
  const e = zip.archivos[nombre]
  if (!e) return null
  const { b, d } = zip
  const p = e.offset
  if (u32(d, p) !== 0x04034b50) throw new Error('El archivo de Excel está dañado.')
  if (e.comprimido === 0xffffffff) throw new Error('Ese Excel es demasiado grande para este lector. Guárdalo como .xlsx normal.')
  const inicio = p + 30 + u16(d, p + 26) + u16(d, p + 28)
  const datos = b.subarray(inicio, inicio + e.comprimido)
  if (e.metodo === 0) return td.decode(datos)
  if (e.metodo !== 8) throw new Error('Ese Excel usa una compresión que no se puede leer. Guárdalo de nuevo como .xlsx.')
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(flujo).text()
}

// ───────── XML ─────────

function desescapar(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, g) => {
    if (g === 'amp') return '&'
    if (g === 'lt') return '<'
    if (g === 'gt') return '>'
    if (g === 'quot') return '"'
    if (g === 'apos') return "'"
    return String.fromCodePoint(g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10))
  })
}
const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// "B" → 1, "AA" → 26
function columnaAIndice(ref) {
  const letras = (ref || '').match(/^[A-Z]+/)
  if (!letras) return -1
  let n = 0
  for (const c of letras[0]) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

// ───────── Leer un Excel ─────────
// Devuelve un arreglo de filas; cada fila es un arreglo de textos.
export async function leerExcel(archivo) {
  let buffer
  if (archivo instanceof ArrayBuffer) buffer = archivo
  // Un Uint8Array puede ser una ventana dentro de un bloque más grande
  // (así los entrega Node); hay que recortar justo lo del archivo.
  else if (ArrayBuffer.isView(archivo)) buffer = archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength)
  else buffer = await archivo.arrayBuffer()
  const zip = abrirZip(buffer)

  // Textos compartidos (así guarda Excel las palabras repetidas).
  const compartidos = []
  const xmlSS = await leerDelZip(zip, 'xl/sharedStrings.xml')
  if (xmlSS) {
    for (const [, si] of xmlSS.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      let texto = ''
      for (const [, t] of si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) texto += desescapar(t)
      compartidos.push(texto)
    }
  }

  // La primera hoja del libro.
  let hoja = 'xl/worksheets/sheet1.xml'
  const libro = await leerDelZip(zip, 'xl/workbook.xml')
  const rels = await leerDelZip(zip, 'xl/_rels/workbook.xml.rels')
  const idHoja = libro?.match(/<sheet[^>]*r:id="([^"]+)"/)?.[1]
  if (idHoja && rels) {
    const destino = rels.match(new RegExp(`Id="${idHoja}"[^>]*Target="([^"]+)"`))?.[1]
    if (destino) hoja = 'xl/' + destino.replace(/^\/?xl\//, '')
  }
  if (!zip.archivos[hoja]) hoja = Object.keys(zip.archivos).find((n) => /^xl\/worksheets\/.*\.xml$/.test(n))
  const xml = hoja && await leerDelZip(zip, hoja)
  if (!xml) throw new Error('El Excel no tiene ninguna hoja con datos.')

  const filas = []
  for (const [, contenido] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila = []
    for (const [, atributos, cuerpo] of contenido.matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = columnaAIndice(atributos.match(/r="([A-Z]+)/)?.[1])
      const tipo = atributos.match(/t="([^"]+)"/)?.[1]
      let valor = ''
      if (tipo === 'inlineStr') {
        for (const [, t] of (cuerpo || '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) valor += desescapar(t)
      } else {
        const v = (cuerpo || '').match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (v != null) valor = tipo === 's' ? (compartidos[Number(v)] ?? '') : desescapar(v)
      }
      if (col >= 0) fila[col] = valor
      else fila.push(valor)
    }
    filas.push(Array.from(fila, (x) => (x == null ? '' : String(x).trim())))
  }
  // Quita las filas totalmente vacías del final.
  while (filas.length && filas[filas.length - 1].every((c) => !c)) filas.pop()
  return filas
}

// ───────── ZIP: escribir (sin comprimir) ─────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()
function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function armarZip(entradas) {
  const partes = []
  const central = []
  let offset = 0
  for (const [nombre, texto] of entradas) {
    const datos = te.encode(texto)
    const nom = te.encode(nombre)
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)      // versión necesaria
    local.setUint16(8, 0, true)       // sin comprimir
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nom.length, true)
    partes.push(new Uint8Array(local.buffer), nom, datos)

    const cab = new DataView(new ArrayBuffer(46))
    cab.setUint32(0, 0x02014b50, true)
    cab.setUint16(4, 20, true)
    cab.setUint16(6, 20, true)
    cab.setUint16(10, 0, true)
    cab.setUint32(16, crc, true)
    cab.setUint32(20, datos.length, true)
    cab.setUint32(24, datos.length, true)
    cab.setUint16(28, nom.length, true)
    cab.setUint32(42, offset, true)
    central.push(new Uint8Array(cab.buffer), nom)
    offset += 30 + nom.length + datos.length
  }
  const tamCentral = central.reduce((n, x) => n + x.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, entradas.length, true)
  fin.setUint16(10, entradas.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, offset, true)

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const total = todo.reduce((n, x) => n + x.length, 0)
  const salida = new Uint8Array(total)
  let p = 0
  for (const x of todo) { salida.set(x, p); p += x.length }
  return salida
}

// ───────── Crear un Excel ─────────
// filas: arreglo de arreglos. La primera fila se pone en negrita (títulos).
export function crearExcel(filas, nombreHoja = 'Hoja1') {
  const letra = (i) => {
    let s = ''
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
    return s
  }
  const xmlFilas = filas.map((fila, f) => {
    const celdas = fila.map((valor, c) => {
      const ref = letra(c) + (f + 1)
      const estilo = f === 0 ? ' s="1"' : ''
      if (valor == null || valor === '') return ''
      if (typeof valor === 'number') return `<c r="${ref}"${estilo}><v>${valor}</v></c>`
      return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`
    }).join('')
    return `<row r="${f + 1}">${celdas}</row>`
  }).join('')

  const anchos = (filas[0] || []).map((_, c) => {
    const ancho = Math.min(46, Math.max(12, ...filas.map((f) => String(f[c] ?? '').length + 3)))
    return `<col min="${c + 1}" max="${c + 1}" width="${ancho}" customWidth="1"/>`
  }).join('')

  return armarZip([
    ['[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapar(nombreHoja).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`],
    ['xl/worksheets/sheet1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos}</cols><sheetData>${xmlFilas}</sheetData></worksheet>`],
  ])
}

// Hace que el navegador descargue un Excel ya armado.
export function descargarExcel(filas, nombreArchivo, nombreHoja) {
  const bytes = crearExcel(filas, nombreHoja)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
