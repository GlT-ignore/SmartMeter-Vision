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

// Custom flat order mapping - flats not in this list will appear at the end
const FLAT_ORDER: Record<string, number> = {
  'S1': 1,
  'A1': 2,
  'B1': 3,
  'C1': 4,
  'D1': 5,
  'Guest House': 6,
  'H1': 7,
  'A2': 8,
  'B2': 9,
  'C2': 10,
  'D2': 11,
  'E2': 12,
  'F2': 13,
  'G2': 14,
  'H2': 15,
  'A3': 16,
  'B3': 17,
  'C3': 18,
  'D3': 19,
  'E3': 20,
  'F3': 21,
  'G3': 22,
  'H3': 23,
  'A4': 24,
  'B4': 25,
  'C4': 26,
  'D4': 27,
  'E4': 28,
  'F4': 29,
  'G4': 30,
  'H4': 31,
  'P1': 32,
  'P2': 33,
}

// Get sort order for a flat ID (returns Infinity if not in the custom order)
const getFlatSortOrder = (flatId: string): number => {
  return FLAT_ORDER[flatId] ?? Infinity
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
        // Sort by custom flat order, then alphabetically for flats not in the custom order
        const orderA = getFlatSortOrder(a.flatId)
        const orderB = getFlatSortOrder(b.flatId)
        
        // If both flats are in the custom order, sort by their order
        if (orderA !== Infinity && orderB !== Infinity) {
          return orderA - orderB
        }
        
        // If only one is in the custom order, it comes first
        if (orderA !== Infinity) return -1
        if (orderB !== Infinity) return 1
        
        // If neither is in the custom order, sort alphabetically
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
    
    // Define margins (top, bottom, left, right)
    const marginTop = 10
    const marginBottom = 10
    const marginLeft = 10
    const marginRight = 10
    
    // Calculate usable area per page
    const usablePageHeight = pageHeight - marginTop - marginBottom
    const imgWidth = pageWidth - marginLeft - marginRight
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // Calculate how many pages we need
    const totalPages = Math.ceil(imgHeight / usablePageHeight)
    
    // Render image across multiple pages with proper margins
    let yOffset = 0 // Current Y offset in the full image (in mm)
    
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        doc.addPage()
      }
      
      // Calculate how much of the image to show on this page
      const remainingHeight = imgHeight - yOffset
      const heightOnThisPage = Math.min(usablePageHeight, remainingHeight)
      
      // Calculate the source Y position in pixels
      const sourceY = (yOffset / imgHeight) * canvas.height
      const sourceHeight = (heightOnThisPage / imgHeight) * canvas.height
      
      // Create a temporary canvas for this page's portion
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.ceil(sourceHeight)
      const pageCtx = pageCanvas.getContext('2d')
      
      if (pageCtx) {
        // Draw the portion of the image for this page
        pageCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight, // source rectangle
          0, 0, canvas.width, Math.ceil(sourceHeight) // destination rectangle
        )
        
        const pageImgData = pageCanvas.toDataURL('image/png')
        
        // Add to PDF with proper margins - always start at marginTop
        // Use heightOnThisPage directly since it's already in mm
        doc.addImage(
          pageImgData,
          'PNG',
          marginLeft,
          marginTop,
          imgWidth,
          heightOnThisPage
        )
      }
      
      // Move to next page's starting position
      yOffset += heightOnThisPage
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

