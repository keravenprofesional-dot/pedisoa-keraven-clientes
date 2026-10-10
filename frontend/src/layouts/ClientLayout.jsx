import { Outlet } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import BotonVolver from '../components/BotonVolver'
import Logo from '../components/Logo'

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-graclaro">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center gap-3 px-3 py-2">
        <BotonVolver className="text-petroleo" />
        <Logo size="sm" />
        <span className="font-bold text-petroleo">Pedidos Keraven</span>
      </header>
      <Outlet />
      <BottomNav />
    </div>
  )
}
