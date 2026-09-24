import { Outlet } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-graclaro">
      <Outlet />
      <BottomNav />
    </div>
  )
}
