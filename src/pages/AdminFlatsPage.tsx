import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthState } from '../services/auth'
import { createFlat } from '../services/flats'
import { createUser } from '../services/users'

const AdminFlatsPage = () => {
  const { user } = useAuthState()
  const navigate = useNavigate()

  const [flatId, setFlatId] = useState('')
  const [initialReading, setInitialReading] = useState('')
  const [tariffPerUnit, setTariffPerUnit] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (!user) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!flatId.trim()) {
      setError('Flat ID is required.')
      return
    }
    if (!tariffPerUnit.trim()) {
      setError('Tariff per unit is required.')
      return
    }
    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (!password.trim()) {
      setError('Password is required.')
      return
    }

    const parsedTariff = Number(tariffPerUnit)
    const parsedInitial =
      initialReading.trim() === '' ? null : Number(initialReading)

    if (Number.isNaN(parsedTariff)) {
      setError('Please enter a valid number for Tariff per unit.')
      return
    }
    if (parsedInitial !== null && Number.isNaN(parsedInitial)) {
      setError('Please enter a valid number for Initial reading.')
      return
    }

    try {
      setSubmitting(true)

      // First create the user
      const userId = await createUser(username.trim(), password, 'tenant', flatId.trim())

      // Then create the flat
      await createFlat({
        flatId: flatId.trim(),
        ownerName: ownerName.trim() || undefined,
        tariffPerUnit: parsedTariff,
        userId,
        initialReading: parsedInitial,
      })

      setSuccess('Tenant and flat created successfully.')
      // Clear form but keep tariff as it is usually the same.
      setFlatId('')
      setInitialReading('')
      setOwnerName('')
      setUsername('')
      setPassword('')
    } catch (err) {
       
      console.error('Error creating tenant:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to create tenant. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout
      username={user.username}
      role="admin"
      subtitle="Create and manage flat entries in Firestore."
    >
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Create new tenant & flat</h2>
              <p className="card-subtitle">
                Create a tenant user account and associated flat.
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

          <form className="stack" onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label className="label" htmlFor="flat-id">
                  Flat ID
                </label>
                <input
                  id="flat-id"
                  className="input"
                  type="text"
                  placeholder='e.g. "A-101"'
                  value={flatId}
                  onChange={(e) => setFlatId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="initial-reading">
                  Initial reading
                </label>
                <input
                  id="initial-reading"
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 21091.10"
                  value={initialReading}
                  onChange={(e) => setInitialReading(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor="tariff">
                  Tariff per unit
                </label>
                <input
                  id="tariff"
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 7.5"
                  value={tariffPerUnit}
                  onChange={(e) => setTariffPerUnit(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="owner-name">
                Owner name
              </label>
              <input
                id="owner-name"
                className="input"
                type="text"
                placeholder='e.g. "Chanikya Gajjarapu"'
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label className="label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="input"
                  type="text"
                  placeholder='e.g. "flat_a101"'
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
                  placeholder="Set tenant password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create tenant & flat'}
            </button>

            {error ? <div className="status rejected">{error}</div> : null}
            {success ? <div className="status approved">{success}</div> : null}
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default AdminFlatsPage

