const { generarCodigoCombo } = await import('../../frontend/src/utils/codigoProducto.js')
let ok = 0, mal = 0
const p = (nombre, tipo, esperado) => {
  const r = generarCodigoCombo(nombre, tipo)
  r === esperado ? (ok++, console.log('  OK   ', nombre.padEnd(38), '→', r))
                 : (mal++, console.log('  FALLA', nombre.padEnd(38), '→', r, '(esperaba', esperado + ')'))
}
p('DUO-PACK- SHAMPOO-COCO-16', 'duo_pack', 'DP-COC-16')
p('DUO-PACK-CACAO-16', 'duo_pack', 'DP-CAC-16')
p('DUO PACK · 16 SHAMPOO DE 16 OZ', 'duo_pack', 'DP-16')
p('Duo Pack de Zanahoria 10 oz', 'duo_pack', 'DP-ZAN-10')
p('Duo Kit Golden Black', 'duo_kit', 'DK-GOL')
p('Duo Kit Jengibre y Romero 32 oz', 'duo_kit', 'DK-JEN-32')
p('Caja Especial', 'duo_pack', 'DP-CAJ')
console.log(`\nResultado: ${ok} bien, ${mal} fallas`)
