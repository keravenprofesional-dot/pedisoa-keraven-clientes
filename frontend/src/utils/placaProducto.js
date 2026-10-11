// De qué está hecha la placa de un producto: todo sale del nombre y del código
// que ya genera codigoProducto.js. Nada nuevo en la base de datos.
//
// Mientras no haya fotos de Keraven, cada tarjeta se sostiene con su inicial
// en dorado y el color de su sabor. Dos shampoos distintos no se ven iguales.
import { generarCodigo, partirCodigo, nombreDeSabor } from './codigoProducto'
import { tamanoOz } from './ordenProducto'

const FAMILIA = {
  TR: 'Tratamiento', MA: 'Mascarilla', SH: 'Shampoo', AC: 'Acondicionador', BA: 'Bálsamo',
  ES: 'Escultor', SP: 'Spray', GO: 'Gotero', LE: 'Leave-in', LA: 'Laceador', GR: 'Grasita',
  GE: 'Gel', CI: 'Cirugía', CE: 'Células', CR: 'Crema', AE: 'Aceite', SE: 'Serum',
  TI: 'Tinte', KE: 'Keratina', LIN: 'Línea', LN: 'Línea', KIT: 'Kit',
  DP: 'Duo Pack', DK: 'Duo Kit',
}

const FOIL = {
  MIE: 'f-mie', COC: 'f-coc', CAC: 'f-cac', ZAN: 'f-zan', BAN: 'f-ban', DET: 'f-det',
  JEN: 'f-jen', ROM: 'f-jen', GOL: 'f-gol', RIZ: 'f-riz', CRE: 'f-cre', BRI: 'f-bri',
  MOL: 'f-mol',
}

export function placaDe(producto) {
  const codigo = producto.codigo || generarCodigo(producto.nombre)
  const p = partirCodigo(codigo) || {}
  const familia = FAMILIA[p.tipo] || 'Keraven'
  // En "LE-8" lo segundo son las onzas, no un sabor: ese producto no tiene sabor.
  const tieneSabor = p.sabor && !/^\d+$/.test(p.sabor)
  const sabor = tieneSabor ? nombreDeSabor(p.sabor) : ''
  return {
    codigo,
    familia,
    sabor,
    oz: tamanoOz(producto.nombre),
    inicial: ((sabor || familia).trim()[0] || 'K').toUpperCase(),
    foil: (tieneSabor && FOIL[p.sabor]) || 'f-base',
  }
}
