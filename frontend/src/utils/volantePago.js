import logoUrl from '../assets/logo.jpg'
import { formatMoney } from './format'

// VOLANTE DE DESGLOSE DE PAGO
// Una imagen (PNG) con lo que lleva el pedido, el descuento, el envío, el
// total, lo que ya pagó y lo que falta, más las cuentas para transferir.
// Se dibuja a mano en un canvas para no depender de nada de afuera.

const ANCHO = 1080
const M = 64 // margen
const C = {
  negro: '#0D0D0D', oro: '#D4A431', oroprof: '#8C6A14', crema: '#FBF6EA',
  tinta: '#2B2522', gris: '#6B645C', linea: '#E6DCC8', rojo: '#B42318', verde: '#1E7B3C',
}
const LETRA = 'Inter, "Segoe UI", Roboto, Arial, sans-serif'

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

function fechaCorta(f) {
  return new Date(f).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * datos = { order, cliente: { full_name, client_number }, items: [{ cantidad, subtotal, nombre, detalle }],
 *           pagado, cuentas: [{ banco, tipo_cuenta, numero, titular }], direccion }
 * Devuelve un Blob PNG.
 */
export async function dibujarVolante(datos) {
  const { order, cliente, items, pagado, cuentas, direccion } = datos
  const subtotal = Number(order.subtotal || 0)
  const descuento = Number(order.descuento || 0)
  const envio = Number(order.envio || 0)
  const total = Number(order.total || 0)
  const yaPago = Math.min(Number(pagado || 0), total)
  const falta = Math.max(total - yaPago, 0)
  const envioPendiente = order.delivery_method === 'envio' && envio === 0

  const logo = await cargarImagen(logoUrl)

  // Primera pasada para medir el alto; segunda para dibujar.
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
    texto('DESGLOSE DE PAGO', ANCHO - M, 110, { tam: 44, peso: 800, color: C.oro, alin: 'right' })
    texto(`Pedido ${order.order_number || ''}`, ANCHO - M, 160, { tam: 32, peso: 600, color: '#FFFFFF', alin: 'right' })
    texto(fechaCorta(order.created_at), ANCHO - M, 200, { tam: 26, color: '#CFC6B4', alin: 'right' })
    y = altoCab + 70

    // ── Clienta
    texto('CLIENTA', M, y, { tam: 22, peso: 700, color: C.oroprof })
    y += 44
    texto(`${cliente?.full_name || ''}${cliente?.client_number ? `  ·  ${cliente.client_number}` : ''}`, M, y, { tam: 34, peso: 700 })
    if (direccion) {
      ctx.font = `400 26px ${LETRA}`
      for (const l of partir(ctx, `Envío a: ${direccion}`, ANCHO - 2 * M)) { y += 38; texto(l, M, y, { tam: 26, color: C.gris }) }
    }
    y += 76

    // ── Productos
    texto('PRODUCTO', M, y, { tam: 22, peso: 700, color: C.oroprof })
    texto('IMPORTE', ANCHO - M, y, { tam: 22, peso: 700, color: C.oroprof, alin: 'right' })
    y += 20; raya(y, C.oro, 3); y += 20
    for (const it of items) {
      ctx.font = `600 30px ${LETRA}`
      const lineas = partir(ctx, `${it.cantidad} × ${it.nombre}`, ANCHO - 2 * M - 260)
      lineas.forEach((l, i) => {
        y += 42
        texto(l, M, y, { tam: 30, peso: 600 })
        if (i === 0) texto(formatMoney(it.subtotal), ANCHO - M, y, { tam: 30, peso: 600, alin: 'right' })
      })
      if (it.detalle?.length) {
        ctx.font = `400 24px ${LETRA}`
        const txt = it.detalle.map((d) => `${d.cantidad} ${d.nombre}`).join(' · ')
        for (const l of partir(ctx, txt, ANCHO - 2 * M - 260)) { y += 34; texto(l, M + 24, y, { tam: 24, color: C.gris }) }
      }
      y += 22; raya(y)
    }

    // ── Cuentas del pedido
    y += 30
    const renglon = (etiqueta, valor, opc = {}) => {
      y += opc.alto || 50
      texto(etiqueta, M, y, { tam: opc.tam || 30, peso: opc.peso || 400, color: opc.color || C.tinta })
      texto(valor, ANCHO - M, y, { tam: opc.tam || 30, peso: opc.peso || 600, color: opc.color || C.tinta, alin: 'right' })
    }
    renglon('Subtotal', formatMoney(subtotal))
    if (descuento > 0) renglon(`Descuento${order.descuento_nota ? ` (${order.descuento_nota})` : ''}`.slice(0, 48), `− ${formatMoney(descuento)}`, { color: C.verde })
    if (envio > 0) renglon(`Envío${order.envio_nota ? ` (${order.envio_nota})` : ''}`.slice(0, 48), `+ ${formatMoney(envio)}`)
    else if (envioPendiente) renglon('Envío', 'por confirmar', { color: C.oroprof })
    y += 26; raya(y, C.tinta, 3)
    renglon('TOTAL A PAGAR', formatMoney(total), { tam: 42, peso: 800, alto: 70 })
    if (yaPago > 0) renglon('Ya pagado', `− ${formatMoney(yaPago)}`, { color: C.verde })

    // ── Recuadro de lo que falta
    y += 40
    const altoCaja = 130
    if (pintar) {
      ctx.fillStyle = falta > 0 ? '#FCE8E6' : '#E6F4EA'
      ctx.fillRect(M, y, ANCHO - 2 * M, altoCaja)
      ctx.fillStyle = falta > 0 ? C.rojo : C.verde
      ctx.fillRect(M, y, 12, altoCaja)
    }
    if (falta > 0) {
      texto('PENDIENTE POR PAGAR', M + 44, y + 80, { tam: 32, peso: 800, color: C.rojo })
      texto(formatMoney(falta), ANCHO - M - 32, y + 82, { tam: 48, peso: 800, color: C.rojo, alin: 'right' })
    } else {
      texto('PAGADO COMPLETO', M + 44, y + 80, { tam: 36, peso: 800, color: C.verde })
      texto('¡Gracias!', ANCHO - M - 32, y + 80, { tam: 36, peso: 700, color: C.verde, alin: 'right' })
    }
    y += altoCaja

    // ── Dónde pagar
    if (falta > 0 && cuentas?.length) {
      y += 70
      texto('PUEDES TRANSFERIR A', M, y, { tam: 22, peso: 700, color: C.oroprof })
      y += 12
      for (const b of cuentas) {
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
  const ctx = lienzo.getContext('2d')
  dibujar(ctx, true)
  return new Promise((ok) => lienzo.toBlob(ok, 'image/png'))
}

// Comparte la imagen (WhatsApp en el celular) o la descarga en la PC.
export async function compartirVolante(blob, nombre, telefono) {
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
  const tel = String(telefono || '').replace(/\D/g, '')
  if (tel) window.open(`https://wa.me/${tel.length === 10 ? '1' + tel : tel}`, '_blank', 'noopener')
  return 'descargado'
}
