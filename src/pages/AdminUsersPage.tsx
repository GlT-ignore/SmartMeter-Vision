import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthState } from '../services/auth'
import { getAllUsers, updateUsername, updateUserPassword } from '../services/users'
import type { User } from '../types/models'

const AdminUsersPage = () => {
  const { user } = useAuthState()
  const navigate = useNavigate()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const allUsers = await getAllUsers()
      setUsers(allUsers)
    } catch (err) {
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (userId: string, currentUsername: string) => {
    setEditingUserId(userId)
    setNewUsername(currentUsername)
    setNewPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
    setNewUsername('')
    setNewPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleUpdateUsername = async (e: FormEvent, userId: string) => {
    e.preventDefault()
    if (!newUsername.trim()) {
      setError('Username cannot be empty.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUsername(userId, newUsername.trim())
      setSuccess('Username updated successfully.')
      await loadUsers()
      handleCancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!newPassword.trim()) {
      setError('Password cannot be empty.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUserPassword(userId, newPassword)
      setSuccess('Password reset successfully.')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleUsers: User[] = users
    .filter((u) => {
      const term = searchQuery.trim().toLowerCase()
      if (!term) return true
      return u.username.toLowerCase().includes(term)
    })
    .slice()
    .sort((a, b) => {
      // Keep admin users at the top, then sort remaining usernames alphabetically.
      const aIsAdmin = a.role === 'admin'
      const bIsAdmin = b.role === 'admin'
      if (aIsAdmin && !bIsAdmin) return -1
      if (!aIsAdmin && bIsAdmin) return 1
      return a.username.toLowerCase().localeCompare(b.username.toLowerCase())
    })

  if (!user) return null

  return (
    <Layout
      username={user.username}
      role="admin"
      subtitle="Manage user accounts and credentials."
    >
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Manage users</h2>
              <p className="card-subtitle">
                Change usernames and reset passwords for tenants and admins.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/admin')}
            >
              Back to admin dashboard
            </button>
          </div>

          {loading ? (
            <p className="muted">Loading users...</p>
          ) : (
            <div className="stack">
              <div className="mobile-stack" style={{ gap: 8, maxWidth: 420 }}>
                <input
                  className="input input-inline mobile-full-width"
                  type="text"
                  placeholder="Search by username"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  className="btn btn-tertiary mobile-full-width"
                  type="button"
                  // Filtering happens live as you type; this button is mainly
                  // here for UX and does not need extra logic.
                  onClick={() => setSearchQuery((prev) => prev.trim())}
                >
                  Search
                </button>
              </div>

              {/* Desktop table view */}
              <div className="table-container hide-on-mobile">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {editingUserId === u.id ? (
                            <input
                              className="input input-inline"
                              type="text"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                            />
                          ) : (
                            <strong>{u.username}</strong>
                          )}
                        </td>
                        <td>
                          <span className="pill">{u.role}</span>
                        </td>
                        <td>
                          {editingUserId === u.id ? (
                            <div className="stack">
                              <div className="row" style={{ gap: 8 }}>
                                <button
                                  className="btn btn-secondary"
                                  type="button"
                                  disabled={submitting}
                                  onClick={(e) => handleUpdateUsername(e, u.id)}
                                >
                                  {submitting ? 'Saving...' : 'Save username'}
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                              <div className="row" style={{ gap: 8 }}>
                                <input
                                  className="input input-inline"
                                  type="password"
                                  placeholder="New password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <button
                                  className="btn btn-secondary"
                                  type="button"
                                  disabled={submitting || !newPassword}
                                  onClick={() => handleResetPassword(u.id)}
                                >
                                  {submitting ? 'Resetting...' : 'Reset password'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="btn btn-tertiary"
                              type="button"
                              onClick={() => handleEditClick(u.id, u.username)}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view */}
              <div className="mobile-card-list show-on-mobile">
                {visibleUsers.map((u) => (
                  <div key={u.id} className="mobile-card-item">
                    {editingUserId === u.id ? (
                      <div className="stack">
                        <div>
                          <label className="mobile-card-label">Username</label>
                          <input
                            className="input"
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            style={{ marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <span className="pill">{u.role}</span>
                        </div>
                        <div className="mobile-card-actions">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={submitting}
                            onClick={(e) => handleUpdateUsername(e, u.id)}
                          >
                            {submitting ? 'Saving...' : 'Save username'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                        <div>
                          <label className="mobile-card-label">New Password</label>
                          <input
                            className="input"
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ marginTop: 4 }}
                          />
                        </div>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={submitting || !newPassword}
                          onClick={() => handleResetPassword(u.id)}
                        >
                          {submitting ? 'Resetting...' : 'Reset password'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Username</span>
                          <span className="mobile-card-value">{u.username}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Role</span>
                          <span className="pill">{u.role}</span>
                        </div>
                        <div className="mobile-card-actions">
                          <button
                            className="btn btn-tertiary"
                            type="button"
                            onClick={() => handleEditClick(u.id, u.username)}
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {error ? <div className="status rejected">{error}</div> : null}
              {success ? <div className="status approved">{success}</div> : null}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default AdminUsersPage
