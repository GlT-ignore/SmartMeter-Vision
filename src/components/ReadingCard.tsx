import { useState } from 'react'
import type { Reading } from '../types/models'
import ReceiptModal from './ReceiptModal'
import ImageViewerModal from './ImageViewerModal'

interface Props {
  reading: Reading
  /**
   * Optional image URL for the previous approved reading.
   * This lets tenants visually compare the current and previous meter photos.
   */
  previousImageUrl?: string | null
  /**
   * Optional owner name for receipts.
   */
  ownerName?: string | null
}

const formatDate = (timestamp?: number) => {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString()
}

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  // Format to 3 decimal places and remove trailing zeros
  return value.toFixed(3).replace(/\.?0+$/, '')
}

// Helper to calculate grand total dynamically for display
// This allows fixing the display for historical readings even if the stored 'amount' was calculated incorrectly
const calculateGrandTotal = (reading: Reading) => {
  // If we have a stored amount but it looks like the old "wrong" calculation (no unit factor, or floor logic),
  // we might want to recalculate. However, the safest bet to match the Receipt is to replicate Receipt logic using stored params.

  if (reading.status !== 'approved') {
    return reading.amount ?? 0
  }

  const prev = reading.previousReading ?? 0
  // use correctedReading if available, fallback to ocr or 0
  const current = reading.correctedReading ?? reading.ocrReading ?? 0
  const units = reading.unitsUsed ?? Math.max(0, current - prev)

  const tariffPerKg = reading.tariffAtApproval ?? 70 // fallback to default if missing
  const unitFactor = reading.unitFactorAtApproval ?? 2.3 // fallback
  const minimumCharge = 25 // default minimum charge

  const kgConsumed = units
  const totalKg = kgConsumed * unitFactor
  const energyAmount = totalKg * tariffPerKg

  return energyAmount + minimumCharge
}

const ReadingCard = ({ reading, previousImageUrl, ownerName }: Props) => {
  const [showReceipt, setShowReceipt] = useState(false)
  const [showImage, setShowImage] = useState<null | 'current' | 'previous'>(null)

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <p className="subtitle">Reading</p>
            <h3 className="card-title">{reading.flatId}</h3>
          </div>
          <span className={`status ${reading.status}`}>{reading.status}</span>
        </div>
        <div className="stack">
          {reading.tenantReading !== null && reading.tenantReading !== undefined && reading.status === 'pending' && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <strong>Your reading:</strong>{' '}
              <span>{formatNumber(reading.tenantReading)}</span>
            </div>
          )}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <strong>Approved:</strong>{' '}
            <span>
              {reading.correctedReading !== null && reading.correctedReading !== undefined
                ? formatNumber(reading.correctedReading)
                : 'Pending'}
            </span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <strong>Units:</strong> <span>{formatNumber(reading.unitsUsed)}</span>
            <strong>Amount:</strong>{' '}
            <span>
              {reading.status === 'approved'
                ? formatNumber(calculateGrandTotal(reading))
                : formatNumber(reading.amount)}
            </span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <strong>Created:</strong> <span style={{ wordBreak: 'break-word' }}>{formatDate(reading.createdAt)}</span>
            <strong>Approved:</strong> <span style={{ wordBreak: 'break-word' }}>{formatDate(reading.approvedAt)}</span>
          </div>
          {reading.status === 'rejected' && reading.rejectionReason ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <strong>Rejection reason:</strong> <span className="text-wrap">{reading.rejectionReason}</span>
            </div>
          ) : null}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <strong>Images:</strong>
            <button
              className="pill"
              type="button"
              onClick={() => setShowImage('current')}
              disabled={!reading.imageUrl}
            >
              Current photo
            </button>
            {previousImageUrl ? (
              <button
                className="pill"
                type="button"
                onClick={() => setShowImage('previous')}
              >
                Previous photo
              </button>
            ) : (
              <span className="muted small">No previous photo available</span>
            )}
          </div>
          {reading.status === 'approved' ? (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setShowReceipt(true)}>
                Download receipt
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {showReceipt && (
        <ReceiptModal
          reading={reading}
          ownerName={ownerName ?? undefined}
          onClose={() => setShowReceipt(false)}
        />
      )}
      {showImage === 'current' && reading.imageUrl && (
        <ImageViewerModal imageUrl={reading.imageUrl} onClose={() => setShowImage(null)} />
      )}
      {showImage === 'previous' && previousImageUrl && (
        <ImageViewerModal imageUrl={previousImageUrl} onClose={() => setShowImage(null)} />
      )}
    </>
  )
}

export default ReadingCard
