import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute, { InicioPersonal } from './components/ProtectedRoute'
import { MENU_ADMIN } from './utils/menuAdmin'

import ClientLayout from './layouts/ClientLayout'

// Lo de la clienta viaja en la primera carga: es lo que abre el 99% de la gente.
import Entrada from './screens/Entrada'
import Home from './screens/clienta/Home'
import Catalog from './screens/clienta/Catalog'
import Cart from './screens/clienta/Cart'
import Checkout from './screens/clienta/Checkout'
import MyOrders from './screens/clienta/MyOrders'
import Seguimiento from './screens/clienta/Seguimiento'
import MyPayments from './screens/clienta/MyPayments'
import MyReceipts from './screens/clienta/MyReceipts'
import OrderDetail from './screens/clienta/OrderDetail'
import Profile from './screens/clienta/Profile'

// El panel del personal se baja SOLO cuando alguien del personal entra.
// Así la clienta no paga por descargar el lector de Excel, las pantallas de
// usuarios, roles ni el armador de cajas, que nunca va a abrir.
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const Dashboard = lazy(() => import('./screens/admin/Dashboard'))
const OrdersBoard = lazy(() => import('./screens/admin/OrdersBoard'))
const Dispatch = lazy(() => import('./screens/admin/Dispatch'))
const Catalogo = lazy(() => import('./screens/admin/Catalogo'))
const Clients = lazy(() => import('./screens/admin/Clients'))
const Settings = lazy(() => import('./screens/admin/Settings'))
const Usuarios = lazy(() => import('./screens/admin/Usuarios'))
const Roles = lazy(() => import('./screens/admin/Roles'))
const SeguimientoAdmin = lazy(() => import('./screens/admin/Seguimiento'))
const Solicitudes = lazy(() => import('./screens/admin/Solicitudes'))
const Promociones = lazy(() => import('./screens/admin/Promociones'))
const Estadisticas = lazy(() => import('./screens/admin/Estadisticas'))
const Pagos = lazy(() => import('./screens/admin/Pagos'))

const PANTALLAS = {
  '/admin/resumen': Dashboard,
  '/admin/estadisticas': Estadisticas,
  '/admin/pedidos': OrdersBoard,
  '/admin/pagos': Pagos,
  '/admin/seguimiento': SeguimientoAdmin,
  '/admin/despacho': Dispatch,
  '/admin/clientas': Clients,
  '/admin/solicitudes': Solicitudes,
  '/admin/productos': Catalogo,
  '/admin/promociones': Promociones,
  '/admin/configuracion': Settings,
  '/admin/usuarios': Usuarios,
  '/admin/roles': Roles,
}

function Cargando() {
  return (
    <div className="flex items-center justify-center py-24">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-oro/30 border-t-oro" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        {/* Una sola entrada con dos pestañas: clienta o personal */}
        <Route path="/login" element={<Entrada />} />
        {/* La app "Keraven Personal" ya instalada abre aquí: misma entrada. */}
        <Route path="/personal" element={<Entrada />} />

        {/* Clienta */}
        <Route element={<ProtectedRoute tipo="clienta"><ClientLayout /></ProtectedRoute>}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/mis-pedidos" element={<MyOrders />} />
          <Route path="/mis-pedidos/:id" element={<OrderDetail />} />
          <Route path="/seguimiento" element={<Seguimiento />} />
          <Route path="/mis-pagos" element={<MyPayments />} />
          <Route path="/mis-recibos" element={<MyReceipts />} />
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
    </Suspense>
  )
}
