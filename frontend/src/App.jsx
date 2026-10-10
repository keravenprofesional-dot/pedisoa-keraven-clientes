import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute, { InicioPersonal } from './components/ProtectedRoute'
import { MENU_ADMIN } from './utils/menuAdmin'

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

import LoginPersonal from './screens/admin/LoginPersonal'
import Dashboard from './screens/admin/Dashboard'
import OrdersBoard from './screens/admin/OrdersBoard'
import Dispatch from './screens/admin/Dispatch'
import Products from './screens/admin/Products'
import Clients from './screens/admin/Clients'
import Settings from './screens/admin/Settings'
import Usuarios from './screens/admin/Usuarios'
import Roles from './screens/admin/Roles'

const PANTALLAS = {
  '/admin/resumen': Dashboard,
  '/admin/pedidos': OrdersBoard,
  '/admin/despacho': Dispatch,
  '/admin/clientas': Clients,
  '/admin/productos': Products,
  '/admin/configuracion': Settings,
  '/admin/usuarios': Usuarios,
  '/admin/roles': Roles,
}

export default function App() {
  return (
    <Routes>
      {/* Dos puertas separadas */}
      <Route path="/login" element={<Login />} />
      <Route path="/personal" element={<LoginPersonal />} />

      {/* Clienta */}
      <Route element={<ProtectedRoute tipo="clienta"><ClientLayout /></ProtectedRoute>}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/carrito" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/mis-pedidos" element={<MyOrders />} />
        <Route path="/mis-pedidos/:id" element={<OrderDetail />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      {/* Personal: cada pantalla exige su permiso */}
      <Route element={<ProtectedRoute tipo="personal"><AdminLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<InicioPersonal />} />
        {MENU_ADMIN.map((item) => {
          const Pantalla = PANTALLAS[item.to]
          return (
            <Route
              key={item.to}
              path={item.to}
              element={<ProtectedRoute tipo="personal" item={item}><Pantalla /></ProtectedRoute>}
            />
          )
        })}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
