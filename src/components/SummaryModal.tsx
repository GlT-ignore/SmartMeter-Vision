import { useMemo, useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Reading } from '../types/models'
import { getAllFlats } from '../services/flats'

interface Props {
  approvedReadings: Reading[]
  onClose: () => void
}

const DEFAULT_UNIT_CONVERSION_KG = 2.3
const DEFAULT_MINIMUM_CHARGE = 25

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return value.toFixed(3).replace(/\.?0+$/, '')
}

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

// Get month/year from approvedAt timestamp
const getMonthYearFromTimestamp = (timestamp?: number): string => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Format month/year for display
const formatMonthYear = (monthYear: string): string => {
  if (!monthYear) return ''
  const [year, month] = monthYear.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const SummaryModal = ({ approvedReadings, onClose }: Props) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [flats, setFlats] = useState<Record<string, string>>({}) // flatId -> tenantName
  const summaryRef = useRef<HTMLDivElement | null>(null)

  // Get all available months from approved readings
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    approvedReadings.forEach((reading) => {
      const monthYear = reading.yearMonth || getMonthYearFromTimestamp(reading.approvedAt)
      if (monthYear) {
        monthSet.add(monthYear)
      }
    })
    return Array.from(monthSet).sort().reverse() // Most recent first
  }, [approvedReadings])

  // Set default to current month if available, otherwise most recent
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      if (availableMonths.includes(currentMonth)) {
        setSelectedMonth(currentMonth)
      } else {
        setSelectedMonth(availableMonths[0])
      }
    }
  }, [availableMonths, selectedMonth])

  // Load flats data
  useEffect(() => {
    getAllFlats()
      .then((flatsList) => {
        const flatMap: Record<string, string> = {}
        flatsList.forEach((flat) => {
          flatMap[flat.flatId] = flat.tenantName || ''
        })
        setFlats(flatMap)
      })
      .catch((error) => {
        console.error('Error loading flats:', error)
      })
  }, [])

  // Filter readings by selected month
  const filteredReadings = useMemo(() => {
    if (!selectedMonth) return []
    return approvedReadings
      .filter((reading) => {
        const monthYear = reading.yearMonth || getMonthYearFromTimestamp(reading.approvedAt)
        return monthYear === selectedMonth
      })
      .sort((a, b) => {
        // Sort by flatId for consistent ordering
        return a.flatId.localeCompare(b.flatId)
      })
  }, [approvedReadings, selectedMonth])

  // Calculate total bill amount
  const totalBillAmount = useMemo(() => {
    return filteredReadings.reduce((sum, reading) => {
      return sum + calculateGrandTotal(reading)
    }, 0)
  }, [filteredReadings])

  const handleDownloadPdf = async () => {
    if (!summaryRef.current) return

    const canvas = await html2canvas(summaryRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 10

    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10
      doc.addPage()
      doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    const fileName = `summary-${selectedMonth || 'all'}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-summary">
        <div className="card" style={{ maxWidth: '100%', margin: 0 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Monthly Summary</h2>
              <p className="card-subtitle">View and download monthly billing summaries</p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="stack" style={{ marginBottom: 24 }}>
            <label className="label" htmlFor="month-selector">
              Select Month
            </label>
            <select
              id="month-selector"
              className="select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="">Select a month</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthYear(month)}
                </option>
              ))}
            </select>
          </div>

          {selectedMonth && filteredReadings.length > 0 && (
            <div ref={summaryRef} style={{ backgroundColor: '#fff', padding: 24 }}>
              <div style={{ marginBottom: 24, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
                  Monthly Summary
                </h3>
                <p style={{ margin: 0, color: 'var(--color-gray-600)' }}>
                  {formatMonthYear(selectedMonth)}
                </p>
              </div>

              <div className="table-container">
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>S.No.</th>
                      <th style={{ textAlign: 'left' }}>Flat Number</th>
                      <th style={{ textAlign: 'left' }}>Name</th>
                      <th style={{ textAlign: 'right' }}>Meter Reading</th>
                      <th style={{ textAlign: 'right' }}>Bill Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReadings.map((reading, index) => (
                      <tr key={reading.id}>
                        <td>{index + 1}</td>
                        <td>{reading.flatId}</td>
                        <td>{flats[reading.flatId] || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatNumber(
                            reading.correctedReading !== null && reading.correctedReading !== undefined
                              ? reading.correctedReading
                              : reading.ocrReading
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹ {formatNumber(calculateGrandTotal(reading))}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--color-gray-200)' }}>
                      <td colSpan={4} style={{ textAlign: 'right', paddingRight: 16 }}>
                        Total
                      </td>
                      <td style={{ textAlign: 'right' }}>₹ {formatNumber(totalBillAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedMonth && filteredReadings.length === 0 && (
            <p className="muted">No approved readings found for the selected month.</p>
          )}

          {selectedMonth && filteredReadings.length > 0 && (
            <div className="mobile-stack" style={{ marginTop: 24, gap: 8 }}>
              <button
                className="btn btn-primary mobile-full-width"
                type="button"
                onClick={handleDownloadPdf}
              >
                Download PDF
              </button>
              <button className="btn btn-ghost mobile-full-width" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SummaryModal

