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
   * Optional tenant / owner name for receipts.
   */
  occupantName?: string | null
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

const ReadingCard = ({ reading, previousImageUrl, occupantName }: Props) => {
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
            <strong>Amount:</strong> <span>{formatNumber(reading.amount)}</span>
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
          occupantName={occupantName ?? undefined}
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
