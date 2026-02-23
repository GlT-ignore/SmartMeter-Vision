import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../services/auth'
import type { UserRole } from '../types/models'

interface Props {
  children: ReactNode
  username?: string | null
  role?: UserRole
  subtitle?: string
  name?: string | null
  summaryButton?: ReactNode
}

const Layout = ({ children, username, role, subtitle, name, summaryButton }: Props) => {
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <div className="content-container">
        <header className="layout-header">
          <div>
            <h1 className="page-title">SmartMeter Vision</h1>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
          <div className="layout-meta">
            {summaryButton}
            {role ? <span className="badge">Role: {role === 'tenant' ? 'owner' : role}</span> : null}
            {name ? <span className="pill">Name: {name}</span> : null}
            {username ? <span className="pill">{username}</span> : null}
            <button className="btn btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

export default Layout

