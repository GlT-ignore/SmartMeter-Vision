import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/auth'

const LoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(username, password)
      navigate(user.role === 'admin' ? '/admin' : '/tenant', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="content-container">
        <div className="card" style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}>
          <div className="card-header">
            <div>
              <h1 className="card-title">SmartMeter Vision</h1>
              <p className="card-subtitle">Please Login.</p>
            </div>
          </div>
          <form className="stack" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
            {error ? <div className="status rejected">{error}</div> : null}
          </form>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/superuser/login')}
              style={{ fontSize: '12px', color: '#666' }}
            >
              Super User Access
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

