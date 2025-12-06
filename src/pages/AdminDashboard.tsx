import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthState } from '../services/auth'
import {
  approveReading,
  getApprovedReadings,
  getPendingReadings,
  getRejectedReadings,
  rejectReading,
  reopenReading,
  subscribeToPendingReadings,
  subscribeToApprovedReadings,
  subscribeToRejectedReadings,
} from '../services/readings'
import type { Reading, Flat } from '../types/models'
import {
  getGlobalTariff,
  updateGlobalTariff,
  getMinimumPrice,
  updateMinimumPrice,
  getUnitFactor,
  updateUnitFactor,
} from '../services/settings'
import { getAllFlats, updateFlat } from '../services/flats'
import ImageViewerModal from '../components/ImageViewerModal'
import ReceiptModal from '../components/ReceiptModal'
import SummaryModal from '../components/SummaryModal'

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  // Format to 3 decimal places and remove trailing zeros
  return value.toFixed(3).replace(/\.?0+$/, '')
}

const DEFAULT_UNIT_CONVERSION_KG = 2.3
const DEFAULT_MINIMUM_CHARGE = 25

// Calculate grand total the same way the receipt does
const calculateGrandTotal = (reading: Reading): number => {
  const units = reading.unitsUsed ?? 0
  const unitFactor = reading.unitFactorAtApproval ?? DEFAULT_UNIT_CONVERSION_KG
  const tariffPerKg = reading.tariffAtApproval ?? 0
  
  const totalKg = units * unitFactor
  const energyAmount = totalKg * tariffPerKg
  const grandTotal = energyAmount + DEFAULT_MINIMUM_CHARGE
  
  return grandTotal
}

const AdminDashboard = () => {
  const { user } = useAuthState()
  const [pending, setPending] = useState<Reading[]>([])
  const [approvedHistory, setApprovedHistory] = useState<Reading[]>([])
  const [rejectedHistory, setRejectedHistory] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const [flatFilter, setFlatFilter] = useState<string>('')
  const [flatOptions, setFlatOptions] = useState<string[]>([])
  const [globalTariff, setGlobalTariff] = useState<number>(0)
  const [minimumPrice, setMinimumPrice] = useState<number>(250)
  const [unitFactor, setUnitFactor] = useState<number>(2.3)
  const [savingGlobalTariff, setSavingGlobalTariff] = useState(false)
  const [savingMinimumPrice, setSavingMinimumPrice] = useState(false)
  const [savingUnitFactor, setSavingUnitFactor] = useState(false)
  const [historyTab, setHistoryTab] = useState<'approved' | 'rejected'>('approved')
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [flats, setFlats] = useState<Flat[]>([])
  const [initialReadings, setInitialReadings] = useState<Record<string, string>>({})
  const [savingInitialReading, setSavingInitialReading] = useState<string | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<Reading | null>(null)
  const [flatIdToTenantName, setFlatIdToTenantName] = useState<Record<string, string>>({})
  const [showSummary, setShowSummary] = useState(false)

  // Map each flat to its latest approved reading's image URL.
  // This is used to show "previous reading" images alongside the
  // current pending photo for easier cross-checking by admins.
  const latestApprovedImageByFlatId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of approvedHistory) {
      if (!r.imageUrl) continue
      if (map[r.flatId]) continue // keep the first (already latest due to sorting)
      map[r.flatId] = r.imageUrl
    }
    return map
  }, [approvedHistory])

  // For each approved reading, track the image URL of the *previous*
  // approved reading for that same flat. This powers the "Previous photo"
  // button in the admin history table.
  const previousApprovedImageByReadingId = useMemo(() => {
    const map: Record<string, string | null> = {}
    const lastImageByFlat: Record<string, string | null> = {}

    // Work in chronological order so "lastImageByFlat" always refers to
    // the previous approved reading for that flat.
    const sortedAsc = [...approvedHistory].sort(
      (a, b) => (a.approvedAt || a.createdAt || 0) - (b.approvedAt || b.createdAt || 0),
    )

    for (const r of sortedAsc) {
      map[r.id] = lastImageByFlat[r.flatId] ?? null
      if (r.imageUrl) {
        lastImageByFlat[r.flatId] = r.imageUrl
      }
    }

    return map
  }, [approvedHistory])

  const loadData = async (selectedFlat?: string) => {
    setLoading(true)
    try {
      const [
        pendingItems,
        approvedItems,
        rejectedItems,
        allApprovedItems,
        allRejectedItems,
        currentTariff,
        currentMinimumPrice,
        currentUnitFactor,
        allFlats,
      ] = await Promise.all([
        getPendingReadings(),
        getApprovedReadings(selectedFlat || undefined),
        getRejectedReadings(selectedFlat || undefined),
        getApprovedReadings(), // Get all approved readings for flatOptions
        getRejectedReadings(), // Get all rejected readings for flatOptions
        getGlobalTariff().catch(() => 0),
        getMinimumPrice().catch(() => 250),
        getUnitFactor().catch(() => 2.3),
        getAllFlats().catch((error) => {
          console.error('Error loading flats:', error)
          return []
        }),
      ])
      setPending(pendingItems)
      setApprovedHistory(approvedItems)
      setRejectedHistory(rejectedItems)
      setGlobalTariff(currentTariff)
      setMinimumPrice(currentMinimumPrice)
      setUnitFactor(currentUnitFactor)

      // Determine which flats still need an initial reading configured.
      // Show the "Initial Readings" section only for:
      // - flats that have no approved readings yet, AND
      // - flats whose initialReading is either null/undefined or 0.
      const flatsWithApprovedReadings = new Set<string>()
      approvedItems.forEach((r) => flatsWithApprovedReadings.add(r.flatId))
      const flatsNeedingInitialReading = allFlats.filter((flat) => {
        const hasApproved = flatsWithApprovedReadings.has(flat.flatId)
        const initial = flat.initialReading
        const hasNoExplicitInitial =
          initial === null || initial === undefined || initial === 0
        return !hasApproved && hasNoExplicitInitial
      })
      setFlats(flatsNeedingInitialReading)

      // Initialize initial readings state from flats that still need configuration
      const initialReadingsState: Record<string, string> = {}
      flatsNeedingInitialReading.forEach((flat) => {
        if (flat.initialReading !== null && flat.initialReading !== undefined) {
          initialReadingsState[flat.id] = formatNumber(flat.initialReading)
        }
      })
      setInitialReadings(initialReadingsState)
      
      // Create a mapping from flatId to tenantName for receipts
      const tenantNameMap: Record<string, string> = {}
      allFlats.forEach((flat) => {
        tenantNameMap[flat.flatId] = flat.tenantName || ''
      })
      setFlatIdToTenantName(tenantNameMap)
      
      // Build flatOptions from ALL readings (not filtered) so dropdown always shows all flats
      // Sort alphabetically: A3, F4, G4
      const ids = new Set<string>()
      allApprovedItems.forEach((r) => ids.add(r.flatId))
      allRejectedItems.forEach((r) => ids.add(r.flatId))
      setFlatOptions(Array.from(ids).sort())
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(flatFilter)
  }, [flatFilter])

  // Set up real-time listeners for dynamic updates
  useEffect(() => {
    // Subscribe to pending readings
    const unsubscribePending = subscribeToPendingReadings((readings) => {
      setPending(readings)
    })

    // Subscribe to approved readings
    const unsubscribeApproved = subscribeToApprovedReadings((readings) => {
      setApprovedHistory(readings)
    }, flatFilter || undefined)

    // Subscribe to rejected readings
    const unsubscribeRejected = subscribeToRejectedReadings((readings) => {
      setRejectedHistory(readings)
    }, flatFilter || undefined)

    // Cleanup subscriptions on unmount or when flatFilter changes
    return () => {
      unsubscribePending()
      unsubscribeApproved()
      unsubscribeRejected()
    }
  }, [flatFilter])

  // Update flat options whenever approved or rejected readings change
  // Sort alphabetically: A3, F4, G4
  useEffect(() => {
    const ids = new Set<string>()
    approvedHistory.forEach((r) => ids.add(r.flatId))
    rejectedHistory.forEach((r) => ids.add(r.flatId))
    setFlatOptions(Array.from(ids).sort())
  }, [approvedHistory, rejectedHistory])

  const handleApprove = async (reading: Reading) => {
    const raw = (corrections[reading.id] ?? '').trim()
    if (!raw) {
      alert('Please enter a corrected reading before approval.')
      return
    }
    const value = Number(raw)
    if (Number.isNaN(value)) {
      alert('Please enter a valid numeric corrected reading.')
      return
    }
    setSubmitting(reading.id)
    try {
      await approveReading(reading.id, value)
      await loadData(flatFilter)
      setCorrections((prev) => {
        const next = { ...prev }
        delete next[reading.id]
        return next
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setSubmitting(null)
    }
  }

  const handleReject = async (reading: Reading) => {
    const reason = (rejectionReasons[reading.id] ?? '').trim()
    if (!reason) {
      alert('Please enter a rejection reason before rejecting.')
      return
    }
    setSubmitting(reading.id)
    try {
      await rejectReading(reading.id, reason)
      await loadData(flatFilter)
      setRejectionReasons((prev) => {
        const next = { ...prev }
        delete next[reading.id]
        return next
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setSubmitting(null)
    }
  }

  const handleReopen = async (reading: Reading) => {
    const reason = window.prompt('Enter a reason to re-open this reading:') ?? ''
    const trimmed = reason.trim()
    if (!trimmed) {
      alert('Please enter a reason to re-open.')
      return
    }
    setSubmitting(reading.id)
    try {
      await reopenReading(reading.id, trimmed)
      await loadData(flatFilter)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to re-open reading')
    } finally {
      setSubmitting(null)
    }
  }

  const handleSaveGlobalTariff = async () => {
    setSavingGlobalTariff(true)
    try {
      await updateGlobalTariff(globalTariff)
      await loadData(flatFilter)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update global tariff')
    } finally {
      setSavingGlobalTariff(false)
    }
  }

  const handleSaveMinimumPrice = async () => {
    setSavingMinimumPrice(true)
    try {
      await updateMinimumPrice(minimumPrice)
      await loadData(flatFilter)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update minimum price')
    } finally {
      setSavingMinimumPrice(false)
    }
  }

  const handleSaveUnitFactor = async () => {
    setSavingUnitFactor(true)
    try {
      await updateUnitFactor(unitFactor)
      await loadData(flatFilter)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update unit factor')
    } finally {
      setSavingUnitFactor(false)
    }
  }

  const handleSaveInitialReading = async (flatId: string) => {
    setSavingInitialReading(flatId)
    try {
      const value = initialReadings[flatId]
      const readingValue = value && value.trim() !== '' ? Number(value) : null
      if (readingValue !== null && Number.isNaN(readingValue)) {
        alert('Please enter a valid initial reading.')
        setSavingInitialReading(null)
        return
      }
      await updateFlat(flatId, { initialReading: readingValue })
      // Reload data to refresh the list
      await loadData(flatFilter)
      alert('Initial reading saved successfully!')
    } catch (error) {
      console.error('Error saving initial reading:', error)
      alert(error instanceof Error ? error.message : 'Failed to update initial reading')
    } finally {
      setSavingInitialReading(null)
    }
  }

  if (!user) return null

  return (
    <Layout
      username={user.username}
      role="admin"
      subtitle="Review and approve meter readings."
      summaryButton={
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setShowSummary(true)}
        >
          View Summary
        </button>
      }
    >
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Flats & Users</h2>
              <p className="card-subtitle">
                Create and manage flat entries and user accounts.
              </p>
            </div>
            <div className="mobile-stack" style={{ gap: 8 }}>
              <Link className="btn btn-secondary mobile-full-width" to="/admin/flats">
                Add tenant / flat
              </Link>
              <Link className="btn btn-secondary mobile-full-width" to="/admin/users">
                Manage users
              </Link>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Tariff</h2>
              <p className="card-subtitle">
                Configure the global cost per unit/KG, convicto factor, and minimum price. This
                applies to all flats for future approvals.
              </p>
            </div>
          </div>
          <div className="stack">
            <label className="label" htmlFor="global-tariff">
              Global tariff (cost per unit/KG)
            </label>
            <div className="mobile-stack" style={{ gap: 8 }}>
              <input
                id="global-tariff"
                className="input input-inline mobile-full-width"
                type="number"
                step="0.01"
                value={globalTariff}
                onChange={(e) => setGlobalTariff(Number(e.target.value) || 0)}
              />
              <button
                className="btn btn-secondary mobile-full-width"
                type="button"
                disabled={savingGlobalTariff}
                onClick={handleSaveGlobalTariff}
              >
                {savingGlobalTariff ? 'Saving…' : 'Save tariff'}
              </button>
            </div>
            <label className="label" htmlFor="unit-factor">
              Unit factor (Unit convicto K.g)
            </label>
            <div className="mobile-stack" style={{ gap: 8 }}>
              <input
                id="unit-factor"
                className="input input-inline mobile-full-width"
                type="number"
                step="0.01"
                value={unitFactor}
                onChange={(e) => setUnitFactor(Number(e.target.value) || 0)}
              />
              <button
                className="btn btn-secondary mobile-full-width"
                type="button"
                disabled={savingUnitFactor}
                onClick={handleSaveUnitFactor}
              >
                {savingUnitFactor ? 'Saving…' : 'Save unit factor'}
              </button>
            </div>
            <label className="label" htmlFor="minimum-price">
              Minimum price
            </label>
            <div className="mobile-stack" style={{ gap: 8 }}>
              <input
                id="minimum-price"
                className="input input-inline mobile-full-width"
                type="number"
                step="0.01"
                value={minimumPrice}
                onChange={(e) => setMinimumPrice(Number(e.target.value) || 0)}
              />
              <button
                className="btn btn-secondary mobile-full-width"
                type="button"
                disabled={savingMinimumPrice}
                onClick={handleSaveMinimumPrice}
              >
                {savingMinimumPrice ? 'Saving…' : 'Save minimum price'}
              </button>
            </div>
          </div>
        </div>

        {flats.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Initial Readings</h2>
                <p className="card-subtitle">
                  Set the starting meter reading for flats that haven't had any approved readings yet, or that are still using a 0 / unset starting value. This will be used as the previous reading when calculating the first approved reading.
                </p>
              </div>
            </div>
            <div className="stack">
              {/* Desktop table view */}
              <div className="table-container hide-on-mobile">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Flat ID</th>
                      <th>Tenant Name</th>
                      <th>Initial Reading</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flats.map((flat) => (
                      <tr key={flat.id}>
                        <td>
                          <strong>{flat.flatId || flat.id}</strong>
                        </td>
                        <td>{flat.tenantName ?? '—'}</td>
                        <td>
                          <input
                            className="input input-inline"
                            type="number"
                            step="0.01"
                            placeholder="Enter initial reading"
                            value={initialReadings[flat.id] ?? ''}
                            onChange={(e) =>
                              setInitialReadings((prev) => ({ ...prev, [flat.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={savingInitialReading === flat.id}
                            onClick={() => handleSaveInitialReading(flat.id)}
                          >
                            {savingInitialReading === flat.id ? 'Saving…' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile card view */}
              <div className="mobile-card-list show-on-mobile">
                {flats.map((flat) => (
                  <div key={flat.id} className="mobile-card-item">
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Flat ID</span>
                      <span className="mobile-card-value">{flat.flatId || flat.id}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Tenant Name</span>
                      <span className="mobile-card-value">{flat.tenantName ?? '—'}</span>
                    </div>
                    <div>
                      <label className="mobile-card-label">Initial Reading</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        placeholder="Enter initial reading"
                        value={initialReadings[flat.id] ?? ''}
                        onChange={(e) =>
                          setInitialReadings((prev) => ({ ...prev, [flat.id]: e.target.value }))
                        }
                        style={{ marginTop: 4 }}
                      />
                    </div>
                    <div className="mobile-card-actions">
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={savingInitialReading === flat.id}
                        onClick={() => handleSaveInitialReading(flat.id)}
                      >
                        {savingInitialReading === flat.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Pending readings</h2>
              <p className="card-subtitle">Image proof only. Enter the reading manually.</p>
            </div>
            <span className="pill">{pending.length} pending</span>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="muted">No pending readings.</p>
          ) : (
            <div className="stack">
              {pending.map((reading) => (
                <div key={reading.id} className="card" style={{ boxShadow: 'none', padding: 16 }}>
                  <div className="card-header">
                    <div>
                      <p className="subtitle">Flat {reading.flatId}</p>
                      <p className="muted small">
                        Review the photo and enter the correct meter reading below.
                      </p>
                    </div>
                    <div className="mobile-stack" style={{ gap: 8 }}>
                      <button
                        className="btn btn-tertiary mobile-full-width"
                        type="button"
                        onClick={() => setViewingImage(reading.imageUrl)}
                      >
                        Current photo
                      </button>
                      {latestApprovedImageByFlatId[reading.flatId] ? (
                        <button
                          className="btn btn-tertiary mobile-full-width"
                          type="button"
                          onClick={() =>
                            setViewingImage(latestApprovedImageByFlatId[reading.flatId]!)
                          }
                        >
                          Previous photo
                        </button>
                      ) : (
                        <span className="muted small">No previous photo</span>
                      )}
                    </div>
                  </div>
                  <div className="stack">
                    <label className="label" htmlFor={`corrected-${reading.id}`}>
                      Corrected reading
                    </label>
                    <input
                      id={`corrected-${reading.id}`}
                      className="input"
                      type="number"
                      placeholder="Enter corrected reading"
                      value={corrections[reading.id] ?? ''}
                      onChange={(e) =>
                        setCorrections((prev) => ({ ...prev, [reading.id]: e.target.value }))
                      }
                    />
                    <label className="label" htmlFor={`reject-reason-${reading.id}`}>
                      Rejection reason
                    </label>
                    <input
                      id={`reject-reason-${reading.id}`}
                      className="input"
                      type="text"
                      placeholder="Explain why this reading is rejected"
                      value={rejectionReasons[reading.id] ?? ''}
                      onChange={(e) =>
                        setRejectionReasons((prev) => ({ ...prev, [reading.id]: e.target.value }))
                      }
                    />
                    <div className="mobile-stack">
                      <button
                        className="btn btn-primary mobile-full-width"
                        disabled={submitting === reading.id}
                        onClick={() => handleApprove(reading)}
                      >
                        {submitting === reading.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        className="btn btn-ghost mobile-full-width"
                        disabled={submitting === reading.id}
                        onClick={() => handleReject(reading)}
                      >
                        {submitting === reading.id ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">History</h2>
              <p className="card-subtitle">Track approved and rejected readings.</p>
            </div>
            <div className="mobile-stack" style={{ gap: 8 }}>
              <div className="row" role="tablist" style={{ gap: 8 }}>
                <button
                  className={`btn btn-ghost ${historyTab === 'approved' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setHistoryTab('approved')}
                >
                  Approved
                </button>
                <button
                  className={`btn btn-ghost ${historyTab === 'rejected' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setHistoryTab('rejected')}
                >
                  Rejected
                </button>
              </div>
              <select
                className="select input-inline mobile-full-width"
                value={flatFilter}
                onChange={(e) => setFlatFilter(e.target.value)}
              >
                <option value="">All flats</option>
                {flatOptions.map((flat) => (
                  <option key={flat} value={flat}>
                    {flat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : historyTab === 'approved' ? (
            approvedHistory.length === 0 ? (
              <p className="muted">No approved readings yet.</p>
            ) : (
              <div className="stack">
                {/* Desktop table view */}
                <div className="table-container hide-on-mobile">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Flat</th>
                        <th>Period</th>
                        <th>Previous</th>
                        <th>Reading</th>
                        <th>Units</th>
                        <th>Tariff used</th>
                        <th>Grand Total</th>
                        <th>Approved</th>
                        <th>Image</th>
                        <th>Receipt</th>
                        <th>Re-open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.flatId}</td>
                          <td>{item.yearMonth ?? '—'}</td>
                          <td>{formatNumber(item.previousReading)}</td>
                          <td>
                            {item.correctedReading !== null && item.correctedReading !== undefined
                              ? formatNumber(item.correctedReading)
                              : formatNumber(item.ocrReading)}
                          </td>
                          <td>{formatNumber(item.unitsUsed)}</td>
                          <td>{formatNumber(item.tariffAtApproval)}</td>
                          <td>₹ {formatNumber(calculateGrandTotal(item))}</td>
                          <td>
                            {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : '—'}
                          </td>
                          <td>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <button
                                className="pill"
                                type="button"
                                disabled={!item.imageUrl}
                                onClick={() => item.imageUrl && setViewingImage(item.imageUrl)}
                              >
                                Current photo
                              </button>
                              {previousApprovedImageByReadingId[item.id] ? (
                                <button
                                  className="pill"
                                  type="button"
                                  onClick={() =>
                                    setViewingImage(previousApprovedImageByReadingId[item.id]!)
                                  }
                                >
                                  Previous photo
                                </button>
                              ) : (
                                <span className="muted small">No previous photo</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-tertiary"
                              type="button"
                              onClick={() => setViewingReceipt(item)}
                            >
                              View receipt
                            </button>
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              disabled={submitting === item.id}
                              onClick={() => handleReopen(item)}
                            >
                              {submitting === item.id ? 'Re-opening…' : 'Re-open'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile card view */}
                <div className="mobile-card-list show-on-mobile">
                  {approvedHistory.map((item) => (
                    <div key={item.id} className="mobile-card-item">
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Flat</span>
                        <span className="mobile-card-value">{item.flatId}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Period</span>
                        <span className="mobile-card-value">{item.yearMonth ?? '—'}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Previous</span>
                        <span className="mobile-card-value">{formatNumber(item.previousReading)}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Reading</span>
                        <span className="mobile-card-value">
                          {item.correctedReading !== null && item.correctedReading !== undefined
                            ? formatNumber(item.correctedReading)
                            : formatNumber(item.ocrReading)}
                        </span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Units</span>
                        <span className="mobile-card-value">{formatNumber(item.unitsUsed)}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Tariff</span>
                        <span className="mobile-card-value">{formatNumber(item.tariffAtApproval)}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Grand Total</span>
                        <span className="mobile-card-value">₹ {formatNumber(calculateGrandTotal(item))}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Approved</span>
                        <span className="mobile-card-value" style={{ fontSize: 11 }}>
                          {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="mobile-card-actions">
                        <button
                          className="btn btn-tertiary"
                          type="button"
                          disabled={!item.imageUrl}
                          onClick={() => item.imageUrl && setViewingImage(item.imageUrl)}
                        >
                          Current photo
                        </button>
                        {previousApprovedImageByReadingId[item.id] ? (
                          <button
                            className="btn btn-tertiary"
                            type="button"
                            onClick={() =>
                              setViewingImage(previousApprovedImageByReadingId[item.id]!)
                            }
                          >
                            Previous photo
                          </button>
                        ) : null}
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setViewingReceipt(item)}
                        >
                          View receipt
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={submitting === item.id}
                          onClick={() => handleReopen(item)}
                        >
                          {submitting === item.id ? 'Re-opening…' : 'Re-open'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : rejectedHistory.length === 0 ? (
            <p className="muted">No rejected readings.</p>
          ) : (
            <div className="stack">
              {/* Desktop table view */}
              <div className="table-container hide-on-mobile">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Flat</th>
                      <th>Period</th>
                      <th>Reading</th>
                      <th>Reason</th>
                      <th>Created</th>
                      <th>Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedHistory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.flatId}</td>
                        <td>{item.yearMonth ?? '—'}</td>
                        <td>
                          {item.correctedReading !== null && item.correctedReading !== undefined
                            ? formatNumber(item.correctedReading)
                            : formatNumber(item.ocrReading)}
                        </td>
                        <td>{item.rejectionReason ?? '—'}</td>
                        <td>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <button
                            className="pill"
                            type="button"
                            disabled={!item.imageUrl}
                            onClick={() => item.imageUrl && setViewingImage(item.imageUrl)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile card view */}
              <div className="mobile-card-list show-on-mobile">
                {rejectedHistory.map((item) => (
                  <div key={item.id} className="mobile-card-item">
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Flat</span>
                      <span className="mobile-card-value">{item.flatId}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Period</span>
                      <span className="mobile-card-value">{item.yearMonth ?? '—'}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Reading</span>
                      <span className="mobile-card-value">
                        {item.correctedReading !== null && item.correctedReading !== undefined
                          ? formatNumber(item.correctedReading)
                          : formatNumber(item.ocrReading)}
                      </span>
                    </div>
                    <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                      <span className="mobile-card-label">Reason</span>
                      <span className="mobile-card-value" style={{ fontSize: 12, fontWeight: 500 }}>
                        {item.rejectionReason ?? '—'}
                      </span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Created</span>
                      <span className="mobile-card-value" style={{ fontSize: 11 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="mobile-card-actions">
                      <button
                        className="btn btn-tertiary"
                        type="button"
                        disabled={!item.imageUrl}
                        onClick={() => item.imageUrl && setViewingImage(item.imageUrl)}
                      >
                        Open image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {viewingImage && (
        <ImageViewerModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
      )}
      {viewingReceipt && (
        <ReceiptModal
          reading={viewingReceipt}
          occupantName={flatIdToTenantName[viewingReceipt.flatId] || null}
          onClose={() => setViewingReceipt(null)}
        />
      )}
      {showSummary && (
        <SummaryModal
          approvedReadings={approvedHistory}
          onClose={() => setShowSummary(false)}
        />
      )}
    </Layout>
  )
}

export default AdminDashboard

