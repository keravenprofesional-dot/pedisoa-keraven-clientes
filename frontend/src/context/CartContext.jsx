import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([]) // { product, cantidad }

  function addItem(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, { product, cantidad: 1 }]
    })
  }

  function updateQty(productId, cantidad) {
    if (cantidad <= 0) return removeItem(productId)
    setItems((prev) => prev.map((i) => (i.product.id === productId ? { ...i, cantidad } : i)))
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function clearCart() {
    setItems([])
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.product.precio * i.cantidad, 0),
    [items]
  )

  const value = { items, addItem, updateQty, removeItem, clearCart, subtotal }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
