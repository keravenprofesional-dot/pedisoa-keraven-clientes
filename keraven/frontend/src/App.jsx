import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

import ClientLayout from './layouts/ClientLayout'
import AdminLayout from './layouts/AdminLayout'

import Login from './screens/clienta/Login'
import Home from './screens/clienta/Home'
import Catalog from './screens/clienta/Catalog'
import Cart from './screens/clienta/Cart'
import Checkout from './screens/clienta/Checkout'
import MyOrders from './screens/clienta/MyOrders'
import OrderDetail from './screens/clienta/OrderDetail'
import Profile from './screens/clienta/Profile'

import Dashboard from './screens/admin/Dashboard'
import OrdersBoard from './screens/admin/OrdersBoard'
import Dispatch from './screens/admin/Dispatch'
import Products from './screens/admin/Products'
import Clients from './screens/admin/Clients'
import Settings from './screens/admin/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Clienta */}
      <Route
        element={
          <ProtectedRoute roles={['clienta']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/carrito" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/mis-pedidos" element={<MyOrders />} />
        <Route path="/mis-pedidos/:id" element={<OrderDetail />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      {/* Administrador / Despacho */}
      <Route
        element={
          <ProtectedRoute roles={['administrador', 'despacho']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/pedidos" element={<OrdersBoard />} />
        <Route path="/admin/despacho" element={<Dispatch />} />
        <Route path="/admin/productos" element={<Products />} />
        <Route path="/admin/clientes" element={<Clients />} />
        <Route path="/admin/configuracion" element={<Settings />} />
      </Route>
    </Routes>
  )
}
