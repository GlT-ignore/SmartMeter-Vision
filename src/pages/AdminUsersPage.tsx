import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthState } from '../services/auth'
import { getAllUsers, updateUsername, updateUserPassword } from '../services/users'
import { getAllFlats, updateFlat } from '../services/flats'
import type { User, Flat } from '../types/models'

const AdminUsersPage = () => {
  const { user } = useAuthState()
  const navigate = useNavigate()

  const [users, setUsers] = useState<User[]>([])
  const [flats, setFlats] = useState<Flat[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  // Edit Form State
  const [newUsername, setNewUsername] = useState('')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [allUsers, allFlats] = await Promise.all([
        getAllUsers(),
        getAllFlats().catch(() => []) // Catch flat errors so users still load
      ])
      setUsers(allUsers)
      setFlats(allFlats)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (user: User) => {
    setEditingUserId(user.id)
    setNewUsername(user.username)

    // Find the flat belonging to this user to pre-fill the owner name
    const userFlat = flats.find((f) => f.userId === user.id)
    setNewOwnerName(userFlat?.ownerName || userFlat?.tenantName || '')

    setShowPasswordReset(false)
    setNewPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
    setNewUsername('')
    setNewOwnerName('')
    setShowPasswordReset(false)
    setNewPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleSaveProfile = async (e: FormEvent, user: User) => {
    e.preventDefault()
    if (!newUsername.trim()) {
      setError('Username cannot be empty.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // 1. Update the username in auth/users
      if (newUsername.trim() !== user.username) {
        await updateUsername(user.id, newUsername.trim())
      }

      // 2. Update the ownerName in flats
      const userFlat = flats.find((f) => f.userId === user.id)
      if (userFlat && (userFlat.ownerName !== newOwnerName.trim() || userFlat.tenantName !== newOwnerName.trim())) {
        await updateFlat(userFlat.id, { ownerName: newOwnerName.trim() })
      }

      setSuccess('Profile updated successfully.')
      await loadData()
      handleCancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.')
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
                Change usernames and reset passwords for owners and admins.
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
                        {editingUserId === u.id ? (
                          <td colSpan={3}>
                            <div className="card" style={{ padding: 16, margin: 0, boxShadow: 'none', border: '1px solid var(--border)' }}>
                              <p className="subtitle" style={{ marginBottom: 12 }}>Edit Profile</p>

                              <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <label className="label">Username</label>
                                  <input
                                    className="input"
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                  />
                                </div>

                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <label className="label">Owner Name</label>
                                  {u.role === 'admin' ? (
                                    <input className="input" type="text" value="—" disabled />
                                  ) : (
                                    <input
                                      className="input"
                                      type="text"
                                      placeholder="e.g. John Doe"
                                      value={newOwnerName}
                                      onChange={(e) => setNewOwnerName(e.target.value)}
                                    />
                                  )}
                                </div>
                              </div>

                              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                {showPasswordReset ? (
                                  <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
                                      <label className="label">New Password</label>
                                      <input
                                        className="input"
                                        type="password"
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                      />
                                    </div>
                                    <button
                                      className="btn btn-secondary"
                                      type="button"
                                      disabled={submitting || !newPassword}
                                      onClick={() => handleResetPassword(u.id)}
                                    >
                                      {submitting ? 'Resetting...' : 'Confirm Reset Password'}
                                    </button>
                                    <button
                                      className="btn btn-ghost"
                                      type="button"
                                      onClick={() => {
                                        setShowPasswordReset(false)
                                        setNewPassword('')
                                      }}
                                    >
                                      Cancel Password Change
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-tertiary"
                                    type="button"
                                    onClick={() => setShowPasswordReset(true)}
                                  >
                                    Change Password
                                  </button>
                                )}
                              </div>

                              <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-primary"
                                  type="button"
                                  disabled={submitting}
                                  onClick={(e) => handleSaveProfile(e, u)}
                                >
                                  {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td>
                              <strong>{u.username}</strong>
                            </td>
                            <td>
                              <span className="pill">{u.role === 'tenant' ? 'owner' : u.role}</span>
                            </td>
                            <td>
                              <button
                                className="btn btn-tertiary"
                                type="button"
                                onClick={() => handleEditClick(u)}
                              >
                                Edit
                              </button>
                            </td>
                          </>
                        )}
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
                      <div className="stack" style={{ padding: 8 }}>
                        <p className="subtitle" style={{ marginBottom: 4 }}>Edit Profile</p>

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
                          <label className="mobile-card-label">Owner Name</label>
                          {u.role === 'admin' ? (
                            <input className="input" type="text" value="—" disabled style={{ marginTop: 4 }} />
                          ) : (
                            <input
                              className="input"
                              type="text"
                              placeholder="e.g. John Doe"
                              value={newOwnerName}
                              onChange={(e) => setNewOwnerName(e.target.value)}
                              style={{ marginTop: 4 }}
                            />
                          )}
                        </div>

                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                          {showPasswordReset ? (
                            <div className="stack" style={{ gap: 8 }}>
                              <div>
                                <label className="mobile-card-label">New Password</label>
                                <input
                                  className="input"
                                  type="password"
                                  placeholder="Enter new password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  style={{ marginTop: 4 }}
                                />
                              </div>
                              <button
                                className="btn btn-secondary mobile-full-width"
                                type="button"
                                disabled={submitting || !newPassword}
                                onClick={() => handleResetPassword(u.id)}
                              >
                                {submitting ? 'Resetting...' : 'Confirm Reset Password'}
                              </button>
                              <button
                                className="btn btn-ghost mobile-full-width"
                                type="button"
                                onClick={() => {
                                  setShowPasswordReset(false)
                                  setNewPassword('')
                                }}
                              >
                                Cancel Password Change
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-tertiary mobile-full-width"
                              type="button"
                              onClick={() => setShowPasswordReset(true)}
                            >
                              Change Password
                            </button>
                          )}
                        </div>

                        <div className="mobile-card-actions" style={{ marginTop: 16 }}>
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={submitting}
                            onClick={(e) => handleSaveProfile(e, u)}
                          >
                            {submitting ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Username</span>
                          <span className="mobile-card-value">{u.username}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Role</span>
                          <span className="pill">{u.role === 'tenant' ? 'owner' : u.role}</span>
                        </div>
                        <div className="mobile-card-actions">
                          <button
                            className="btn btn-tertiary"
                            type="button"
                            onClick={() => handleEditClick(u)}
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
