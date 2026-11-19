import logoUrl from '../assets/logo.jpg'
import { formatMoney } from './format'

// DOCUMENTOS DE PAGO (imagen PNG para WhatsApp o para guardar)
//   · Recibo de venta / venta actualizado / abono / pagado completo
//   · Volante de desglose de pago (estado del pedido hoy)
// Los dos salen del mismo dibujo: encabezado con el logo, datos de la
// clienta, productos, cuentas y el recuadro de lo que resta o PAGADO.
// Se dibuja a mano en un canvas para no depender de nada de afuera.

const ANCHO = 1080
const M = 64 // margen
const C = {
  negro: '#0D0D0D', oro: '#D4A431', oroprof: '#8C6A14', crema: '#FBF6EA',
  tinta: '#2B2522', gris: '#6B645C', linea: '#E6DCC8', rojo: '#B42318', verde: '#1E7B3C',
}
const LETRA = 'Inter, "Segoe UI", Roboto, Arial, sans-serif'
const METODO = { efectivo: 'Efectivo', transferencia: 'Transferencia', deposito: 'Depósito' }

export const TITULO_RECIBO = {
  venta: 'RECIBO DE VENTA',
  ajuste: 'RECIBO DE VENTA',
  abono: 'RECIBO DE ABONO',
  pagado: 'PAGADO COMPLETO',
}

const fechaLarga = (f) => new Date(f).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
const hora = (f) => new Date(f).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
const tel = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : (t || '') }

function cargarImagen(src) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = src
  })
}

// Parte un texto en renglones que quepan en `max` píxeles.
function partir(ctx, texto, max) {
  const palabras = String(texto || '').split(/\s+/)
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > max && actual) { lineas.push(actual); actual = p } else actual = prueba
  }
  if (actual) lineas.push(actual)
  return lineas.length ? lineas : ['']
}

/**
 * doc = {
 *   titulo, lineaNumero, fecha,
 *   cliente: { nombre, numero, cedula, telefono, direccion },
 *   productos: [{ cantidad, nombre, importe, detalle }],
 *   renglones: [{ etiqueta, valor, color, fuerte }],   // debajo de los productos
 *   resta,                                              // > 0 → recuadro rojo; 0 → PAGADO COMPLETO
 *   restaTexto,                                         // 'RESTA POR PAGAR' o 'PENDIENTE POR PAGAR'
 *   cuentas: [{ banco, tipo_cuenta, numero, titular }], // solo si resta > 0
 * }
 */
export async function dibujarDocumento(doc) {
  const logo = await cargarImagen(logoUrl)
  const medir = document.createElement('canvas').getContext('2d')

  const dibujar = (ctx, pintar) => {
    let y = 0
    const texto = (t, x, yy, { tam = 30, peso = 400, color = C.tinta, alin = 'left' } = {}) => {
      if (!pintar) return
      ctx.font = `${peso} ${tam}px ${LETRA}`
      ctx.fillStyle = color
      ctx.textAlign = alin
      ctx.fillText(t, x, yy)
    }
    const raya = (yy, color = C.linea, grosor = 2) => {
      if (!pintar) return
      ctx.fillStyle = color
      ctx.fillRect(M, yy, ANCHO - 2 * M, grosor)
    }
    const parrafo = (t, x, ancho, { tam = 26, peso = 400, color = C.gris, salto = 36 } = {}) => {
      ctx.font = `${peso} ${tam}px ${LETRA}`
      for (const l of partir(ctx, t, ancho)) { y += salto; texto(l, x, y, { tam, peso, color }) }
    }

    // ── Encabezado negro con el logo
    const altoCab = 250
    if (pintar) {
      ctx.fillStyle = C.crema; ctx.fillRect(0, 0, ANCHO, 99999)
      ctx.fillStyle = C.negro; ctx.fillRect(0, 0, ANCHO, altoCab)
      ctx.fillStyle = C.oro; ctx.fillRect(0, altoCab - 8, ANCHO, 8)
      if (logo) {
        const h = 150, w = (logo.width / logo.height) * h
        ctx.drawImage(logo, M, 46, w, h)
      }
    }
    texto(doc.titulo, ANCHO - M, 106, { tam: 44, peso: 800, color: C.oro, alin: 'right' })
    texto(doc.lineaNumero, ANCHO - M, 156, { tam: 30, peso: 600, color: '#FFFFFF', alin: 'right' })
    texto(`${fechaLarga(doc.fecha)} · ${hora(doc.fecha)}`, ANCHO - M, 198, { tam: 24, color: '#CFC6B4', alin: 'right' })
    y = altoCab + 64

    // ── Clienta
    const cl = doc.cliente || {}
    texto('CLIENTE', M, y, { tam: 22, peso: 700, color: C.oroprof })
    y += 44
    texto(`${cl.nombre || ''}${cl.numero ? `  ·  ${cl.numero}` : ''}`, M, y, { tam: 34, peso: 700 })
    const datos = [cl.cedula && `Cédula ${cl.cedula}`, cl.telefono && `Tel. ${tel(cl.telefono)}`].filter(Boolean).join('   ·   ')
    if (datos) { y += 40; texto(datos, M, y, { tam: 26, color: C.tinta }) }
    if (cl.direccion) parrafo(`Dirección: ${cl.direccion}`, M, ANCHO - 2 * M)
    y += 64

    // ── Productos
    texto('PRODUCTO', M, y, { tam: 22, peso: 700, color: C.oroprof })
    texto('IMPORTE', ANCHO - M, y, { tam: 22, peso: 700, color: C.oroprof, alin: 'right' })
    y += 20; raya(y, C.oro, 3); y += 20
    for (const it of doc.productos || []) {
      ctx.font = `600 30px ${LETRA}`
      partir(ctx, `${it.cantidad} × ${it.nombre}`, ANCHO - 2 * M - 260).forEach((l, i) => {
        y += 42
        texto(l, M, y, { tam: 30, peso: 600 })
        if (i === 0) texto(formatMoney(it.importe), ANCHO - M, y, { tam: 30, peso: 600, alin: 'right' })
      })
      if (it.detalle?.length) {
        ctx.font = `400 24px ${LETRA}`
        const txt = it.detalle.map((d) => `${d.cantidad} ${d.nombre}`).join(' · ')
        for (const l of partir(ctx, txt, ANCHO - 2 * M - 260)) { y += 34; texto(l, M + 24, y, { tam: 24, color: C.gris }) }
      }
      y += 22; raya(y)
    }

    // ── Cuentas
    y += 30
    for (const r of doc.renglones || []) {
      if (r.raya) { y += 26; raya(y, C.tinta, 3); continue }
      y += r.fuerte ? 70 : 50
      const tam = r.fuerte ? 40 : 30
      texto(r.etiqueta.slice(0, 50), M, y, { tam, peso: r.fuerte ? 800 : 400, color: r.color || C.tinta })
      texto(r.valor, ANCHO - M, y, { tam, peso: r.fuerte ? 800 : 600, color: r.color || C.tinta, alin: 'right' })
    }

    // ── Recuadro: lo que resta o PAGADO COMPLETO
    y += 40
    const altoCaja = 130
    const debe = Number(doc.resta) > 0
    if (pintar) {
      ctx.fillStyle = debe ? '#FCE8E6' : '#E6F4EA'
      ctx.fillRect(M, y, ANCHO - 2 * M, altoCaja)
      ctx.fillStyle = debe ? C.rojo : C.verde
      ctx.fillRect(M, y, 12, altoCaja)
    }
    if (debe) {
      texto(doc.restaTexto || 'RESTA POR PAGAR', M + 44, y + 80, { tam: 32, peso: 800, color: C.rojo })
      texto(formatMoney(doc.resta), ANCHO - M - 32, y + 82, { tam: 48, peso: 800, color: C.rojo, alin: 'right' })
    } else {
      texto('PAGADO COMPLETO', M + 44, y + 80, { tam: 36, peso: 800, color: C.verde })
      texto('¡Gracias!', ANCHO - M - 32, y + 80, { tam: 36, peso: 700, color: C.verde, alin: 'right' })
    }
    y += altoCaja

    // ── Dónde pagar
    if (debe && doc.cuentas?.length) {
      y += 70
      texto('PUEDES TRANSFERIR A', M, y, { tam: 22, peso: 700, color: C.oroprof })
      y += 12
      for (const b of doc.cuentas) {
        y += 44
        texto(`${b.banco}${b.tipo_cuenta ? ` · ${b.tipo_cuenta}` : ''}`, M, y, { tam: 28, peso: 700 })
        texto(`Nº ${b.numero}`, ANCHO - M, y, { tam: 28, peso: 700, alin: 'right' })
        if (b.titular) { y += 36; texto(`A nombre de ${b.titular}`, M, y, { tam: 24, color: C.gris }) }
      }
      y += 40
      texto('Envía el comprobante por la app o por WhatsApp.', M, y, { tam: 24, color: C.gris })
    }

    // ── Pie
    y += 80
    if (pintar) { ctx.fillStyle = C.negro; ctx.fillRect(0, y, ANCHO, 110) }
    texto('KERAVEN PROFESIONAL', ANCHO / 2, y + 66, { tam: 28, peso: 800, color: C.oro, alin: 'center' })
    y += 110
    return y
  }

  const alto = dibujar(medir, false)
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = alto
  dibujar(lienzo.getContext('2d'), true)
  return new Promise((ok) => lienzo.toBlob(ok, 'image/png'))
}

// Renglones comunes: subtotal, descuento, envío y la raya antes del total.
function renglonesDelPedido({ subtotal, descuento, descuento_nota, envio, envio_nota, delivery_method }) {
  const r = [{ etiqueta: 'Subtotal', valor: formatMoney(subtotal) }]
  if (Number(descuento) > 0) r.push({ etiqueta: `Descuento${descuento_nota ? ` (${descuento_nota})` : ''}`, valor: `− ${formatMoney(descuento)}`, color: C.verde })
  if (Number(envio) > 0) r.push({ etiqueta: `Envío${envio_nota ? ` (${envio_nota})` : ''}`, valor: `+ ${formatMoney(envio)}` })
  else if (delivery_method === 'envio') r.push({ etiqueta: 'Envío', valor: 'por confirmar', color: C.oroprof })
  r.push({ raya: true })
  return r
}

// Un recibo guardado en la base (tabla recibos) → documento.
export function documentoDeRecibo(rec, cuentas = []) {
  const renglones = [
    ...renglonesDelPedido(rec),
    { etiqueta: 'TOTAL DEL PEDIDO', valor: formatMoney(rec.total), fuerte: true },
  ]
  if (rec.tipo === 'abono' || rec.tipo === 'pagado') {
    if (Number(rec.pagado_antes) > 0) renglones.push({ etiqueta: 'Abonado antes', valor: `− ${formatMoney(rec.pagado_antes)}`, color: C.verde })
    renglones.push({ etiqueta: 'Debía', valor: formatMoney(rec.debia) })
    renglones.push({ etiqueta: `Abonó${rec.metodo ? ` (${METODO[rec.metodo] || rec.metodo})` : ''}`, valor: `− ${formatMoney(rec.abono)}`, color: C.verde })
  } else if (Number(rec.pagado_antes) > 0) {
    renglones.push({ etiqueta: 'Ya pagado', valor: `− ${formatMoney(rec.pagado_antes)}`, color: C.verde })
  }
  return {
    titulo: TITULO_RECIBO[rec.tipo] || 'RECIBO',
    lineaNumero: `Recibo ${rec.numero} · Pedido ${rec.pedido}${rec.tipo === 'ajuste' ? ' · actualizado' : ''}`,
    fecha: rec.fecha,
    cliente: rec.cliente,
    productos: rec.productos,
    renglones,
    resta: rec.resta,
    restaTexto: 'RESTA POR PAGAR',
    cuentas,
  }
}

// El pedido tal como está hoy → volante de desglose de pago.
export function documentoDeVolante({ order, cliente, productos, pagado, cuentas }) {
  const total = Number(order.total || 0)
  const yaPago = Math.min(Number(pagado || 0), total)
  const renglones = [
    ...renglonesDelPedido(order),
    { etiqueta: 'TOTAL A PAGAR', valor: formatMoney(total), fuerte: true },
  ]
  if (yaPago > 0) renglones.push({ etiqueta: 'Ya pagado', valor: `− ${formatMoney(yaPago)}`, color: C.verde })
  return {
    titulo: 'DESGLOSE DE PAGO',
    lineaNumero: `Pedido ${order.order_number || ''}`,
    fecha: new Date(),
    cliente,
    productos,
    renglones,
    resta: Math.max(total - yaPago, 0),
    restaTexto: 'PENDIENTE POR PAGAR',
    cuentas,
  }
}

// Comparte la imagen (WhatsApp en el celular) o la descarga en la PC.
export async function compartirImagen(blob, nombre, telefono) {
  const archivo = new File([blob], `${nombre}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre })
      return 'compartido'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = archivo.name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  // En la PC: además abre el chat de WhatsApp de la clienta para pegar la imagen.
  const t = String(telefono || '').replace(/\D/g, '')
  if (t) window.open(`https://wa.me/${t.length === 10 ? '1' + t : t}`, '_blank', 'noopener')
  return 'descargado'
}
