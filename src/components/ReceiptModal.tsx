import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useRef } from 'react'
import type { Reading } from '../types/models'

interface Props {
  reading: Reading
  onClose: () => void
  occupantName?: string | null
}

const DEFAULT_UNIT_CONVERSION_KG = 2.3
const DEFAULT_MINIMUM_CHARGE = 25
const DUE_DATE_OFFSET_DAYS = 5

const formatDateOnly = (timestamp?: number) => {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('en-IN')
}

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  // Format to 3 decimal places and remove trailing zeros
  return value.toFixed(3).replace(/\.?0+$/, '')
}

const ReceiptModal = ({ reading, onClose, occupantName }: Props) => {
  const receiptRef = useRef<HTMLDivElement | null>(null)
  const prev = reading.previousReading ?? 0
  const current = reading.correctedReading ?? reading.ocrReading ?? 0
  const units = reading.unitsUsed ?? Math.max(0, current - prev)

  const readingDateTs = reading.approvedAt ?? reading.createdAt
  const dueDateTs = readingDateTs
    ? readingDateTs + DUE_DATE_OFFSET_DAYS * 24 * 60 * 60 * 1000
    : undefined

  const tariffPerKg = reading.tariffAtApproval ?? 0
  const unitFactor = reading.unitFactorAtApproval ?? DEFAULT_UNIT_CONVERSION_KG

  const kgConsumed = units
  const totalKg = kgConsumed * unitFactor
  const energyAmount = totalKg * tariffPerKg

  const minimumCharge = DEFAULT_MINIMUM_CHARGE
  const grandTotal = energyAmount + minimumCharge

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return

    // Capture the on-screen receipt card as an image
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')

    // Create a small slip-like PDF and fit the image inside
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 120],
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const imgWidth = pageWidth - 8 // small margin
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const x = (pageWidth - imgWidth) / 2
    const y = Math.max((pageHeight - imgHeight) / 2, 2)

    doc.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight)

    const fileName = `receipt-${reading.flatId}-${reading.yearMonth ?? ''}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-receipt">
        <div className="receipt-container">
          <div className="receipt-paper" ref={receiptRef}>
            <div className="receipt-header">
              <div className="receipt-title">GAS</div>
              <div className="receipt-subtitle">Meter Reading Receipt</div>
            </div>

            <div className="receipt-meta">
              <div className="receipt-meta-row">
                <span className="receipt-label">Name of Owner / Occupant</span>
                <span className="receipt-value">{occupantName || '—'}</span>
              </div>
            </div>

            <div className="receipt-small-grid">
              <div className="receipt-small-box">
                <div className="receipt-small-label">Reading Date</div>
                <div className="receipt-small-value">{formatDateOnly(readingDateTs)}</div>
              </div>
              <div className="receipt-small-box">
                <div className="receipt-small-label">Due Date</div>
                <div className="receipt-small-value">{formatDateOnly(dueDateTs)}</div>
              </div>
              <div className="receipt-small-box">
                <div className="receipt-small-label">Flat No.</div>
                <div className="receipt-small-value">{reading.flatId}</div>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-rows">
              <div className="receipt-row">
                <span className="receipt-label">Minimum charges</span>
                <span className="receipt-value">{formatNumber(minimumCharge)}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Today's reading</span>
                <span className="receipt-value">{formatNumber(current)}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Old reading</span>
                <span className="receipt-value">{formatNumber(prev)}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">K.g. consumed</span>
                <span className="receipt-value">{formatNumber(kgConsumed)}</span>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-rows">
              <div className="receipt-row">
                <span className="receipt-label">Unit × Unit convicto K.g</span>
                <span className="receipt-value">
                  {formatNumber(kgConsumed)} × {formatNumber(unitFactor)} ={' '}
                  {formatNumber(totalKg)}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Total K.g × Rs. per K.g</span>
                <span className="receipt-value">
                  {formatNumber(totalKg)} × {formatNumber(tariffPerKg)} ={' '}
                  {formatNumber(energyAmount)}
                </span>
              </div>
            </div>

            <div className="receipt-total-row">
              <span className="receipt-total-label">Total</span>
              <span className="receipt-total-value">{formatNumber(energyAmount)}</span>
            </div>
            <div className="receipt-total-row">
              <span className="receipt-total-label">+ Minimum</span>
              <span className="receipt-total-value">{formatNumber(minimumCharge)}</span>
            </div>
            <div className="receipt-total-row">
              <span className="receipt-total-label">Grand Total</span>
              <span className="receipt-total-value">₹ {formatNumber(grandTotal)}</span>
            </div>

            <div className="receipt-footer">
              <span>Please pay the bill before the due date</span>
              <br />
              <span>Thank you</span>
            </div>
          </div>

          <div className="receipt-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleDownloadPdf}
            >
              Download PDF
            </button>
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReceiptModal
