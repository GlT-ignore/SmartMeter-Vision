import type { FormEvent } from 'react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllUsers, updateUserPassword } from '../services/users'
import { getCurrentSuperUser, logoutSuperUser } from '../services/superUserAuth'
import type { User } from '../types/models'

const SuperUserDashboard = () => {
  const navigate = useNavigate()
  // Use useState with initializer to only read once on mount
  const [superUser] = useState(() => getCurrentSuperUser())
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  const loadAdminUsers = useCallback(async () => {
    if (hasLoadedRef.current) return // Prevent multiple loads
    hasLoadedRef.current = true
    
    setLoading(true)
    try {
      const allUsers = await getAllUsers()
      const admins = allUsers.filter(u => u.role === 'admin')
      setAdminUsers(admins)
    } catch (err) {
      console.error('Error loading admin users:', err)
      setError('Failed to load admin users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!superUser) {
      navigate('/superuser/login', { replace: true })
      return
    }
    loadAdminUsers()
  }, [superUser, navigate, loadAdminUsers])

  const handleSelectAdmin = (adminId: string) => {
    setSelectedAdminId(adminId)
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!selectedAdminId) {
      setError('Please select an admin user')
      return
    }

    if (!newPassword.trim()) {
      setError('Password cannot be empty')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUserPassword(selectedAdminId, newPassword)
      setSuccess('Admin password reset successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setSelectedAdminId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    logoutSuperUser()
    navigate('/superuser/login', { replace: true })
  }

  if (!superUser) {
    return null
  }

  const selectedAdmin = adminUsers.find(u => u.id === selectedAdminId)

  return (
    <div className="app-shell">
      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <div>
              <h1 className="card-title">Super User Dashboard</h1>
              <p className="card-subtitle">
                Emergency admin password reset tool
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{superUser.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{superUser.email}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="status warning" style={{ marginBottom: '24px' }}>
            <strong>⚠️ Restricted Access</strong>
            <p style={{ marginTop: '8px', marginBottom: 0 }}>
              You are logged in as a super user. Your only function is to reset admin passwords 
              in emergency situations. Use this power responsibly.
            </p>
          </div>

          {loading ? (
            <p className="muted">Loading admin users...</p>
          ) : (
            <div className="stack">
              <div>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Select Admin to Reset Password</h2>
                {adminUsers.length === 0 ? (
                  <p className="muted">No admin users found in the system.</p>
                ) : (
                  <div className="stack" style={{ gap: '8px' }}>
                    {adminUsers.map((admin) => (
                      <button
                        key={admin.id}
                        type="button"
                        className={`btn ${selectedAdminId === admin.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleSelectAdmin(admin.id)}
                        style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                      >
                        <strong>{admin.username}</strong>
                        {selectedAdminId === admin.id && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedAdmin && (
                <div style={{ marginTop: '24px', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>
                    Reset Password for: <strong>{selectedAdmin.username}</strong>
                  </h3>
                  <form onSubmit={handleResetPassword} className="stack">
                    <div>
                      <label className="label" htmlFor="newPassword">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        className="input"
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="confirmPassword">
                        Confirm Password
                      </label>
                      <input
                        id="confirmPassword"
                        className="input"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="row" style={{ gap: '8px' }}>
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={submitting || !newPassword || !confirmPassword}
                      >
                        {submitting ? 'Resetting...' : 'Reset Password'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setSelectedAdminId(null)
                          setNewPassword('')
                          setConfirmPassword('')
                          setError(null)
                          setSuccess(null)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {error ? <div className="status rejected">{error}</div> : null}
              {success ? <div className="status approved">{success}</div> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperUserDashboard
