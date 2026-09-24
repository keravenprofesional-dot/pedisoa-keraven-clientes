import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-graclaro md:flex">
      <Sidebar />
      <div className="flex-1 md:ml-64">
        <Outlet />
      </div>
    </div>
  )
}
