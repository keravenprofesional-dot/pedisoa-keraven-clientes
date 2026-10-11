import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

// Cada renglón del carrito es { clave, product, cantidad, sabores }.
// La "clave" distingue dos cajas del mismo Duo Pack con sabores distintos:
// una de Coco y otra de Coco+Zanahoria son dos renglones separados.
const claveDe = (product, sabores) =>
  sabores?.length ? `${product.id}|${[...sabores].sort().join('|')}` : product.id

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  function addItem(product, sabores = null) {
    const clave = claveDe(product, sabores)
    setItems((prev) => {
      const ya = prev.find((i) => i.clave === clave)
      if (ya) return prev.map((i) => (i.clave === clave ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...prev, { clave, product, cantidad: 1, sabores: sabores || null }]
    })
  }

  function updateQty(clave, cantidad) {
    if (cantidad <= 0) return removeItem(clave)
    setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, cantidad } : i)))
  }

  function removeItem(clave) {
    setItems((prev) => prev.filter((i) => i.clave !== clave))
  }

  function clearCart() {
    setItems([])
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.product.precio) * i.cantidad, 0),
    [items]
  )

  const value = { items, addItem, updateQty, removeItem, clearCart, subtotal }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
