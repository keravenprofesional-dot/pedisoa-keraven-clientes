import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import BotonVolver from '../components/BotonVolver'

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-graclaro md:flex">
      <Sidebar />
      <div className="flex-1 md:ml-64">
        {/* En computadora: barrita para volver atrás (instalada como app no
            hay flecha del navegador). */}
        <div className="hidden md:block px-8 pt-4">
          <BotonVolver className="text-petroleo" />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
