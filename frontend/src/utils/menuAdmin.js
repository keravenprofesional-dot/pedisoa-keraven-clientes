import { LayoutDashboard, Package, Users, ShoppingCart, Truck, Settings, UserCog, KeyRound } from 'lucide-react'

// Pantallas del panel y qué hace falta para verlas.
//   permiso: alguno de estos (lista) basta
//   supremo: solo el supremo usuario
export const MENU_ADMIN = [
  { to: '/admin/resumen', icon: LayoutDashboard, label: 'Resumen', permiso: ['ver_resumen'] },
  { to: '/admin/pedidos', icon: ShoppingCart, label: 'Pedidos', permiso: ['ver_pedidos'] },
  { to: '/admin/despacho', icon: Truck, label: 'Despacho', permiso: ['despacho'] },
  { to: '/admin/clientas', icon: Users, label: 'Clientes', permiso: ['ver_clientas', 'crear_clientas'] },
  { to: '/admin/productos', icon: Package, label: 'Productos', permiso: ['productos'] },
  { to: '/admin/configuracion', icon: Settings, label: 'Configuración', permiso: ['configuracion'] },
  { to: '/admin/usuarios', icon: UserCog, label: 'Usuarios', supremo: true },
  { to: '/admin/roles', icon: KeyRound, label: 'Roles y permisos', supremo: true },
]

export function puedeVer(item, { esSupremo, puede }) {
  if (item.supremo) return esSupremo
  return esSupremo || item.permiso.some((p) => puede(p))
}
