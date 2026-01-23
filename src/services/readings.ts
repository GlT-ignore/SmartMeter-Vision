import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Reading } from '../types/models'
import { getGlobalTariff, getMinimumPrice, getUnitFactor } from './settings'
import { getFlatByFlatId } from './flats'

const getYearMonth = (timestamp: number) => {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Compresses and resizes an image file to fit within Firestore's field size limits
 * while maintaining quality for OCR. Returns a base64 data URL.
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Failed to read file'))
        return
      }
      img.src = e.target.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to JPEG with compression
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    reader.readAsDataURL(file)
  })
}

export async function uploadMeterImage(_flatId: string, file: File): Promise<string> {
  // Storage-free implementation: compress the image and store as a data URL in Firestore.
  // This keeps everything on the free Firestore plan and avoids Cloud Storage entirely.
  // Images are resized to max 1200px width and compressed to ~85% quality to stay under
  // Firestore's ~1MB field size limit while maintaining OCR accuracy.
  return await compressImage(file)
}

export async function createReadingFromImage(flatId: string, imageUrl: string, tenantReading?: number | null): Promise<void> {
  const readingsRef = collection(db, 'readings')
  const now = Date.now()
  const yearMonth = getYearMonth(now)

  // Enforce one upload per calendar month (per flat) without requiring a composite index.
  const existingSnap = await getDocs(query(readingsRef, where('flatId', '==', flatId)))
  const uploadsThisMonth = existingSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
    .filter((r) => (r.yearMonth ?? getYearMonth(r.createdAt || 0)) === yearMonth)
    // Only block if there is a pending or approved reading this month.
    .filter((r) => (r.status ?? 'pending') !== 'rejected')

  if (uploadsThisMonth.length > 0) {
    const latest = uploadsThisMonth.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    const dateStr = latest.createdAt ? new Date(latest.createdAt).toLocaleDateString() : null
    throw new Error(
      dateStr
        ? `Upload limit reached. You already have a pending/approved upload on ${dateStr}. Try again next month.`
        : 'Upload limit reached for this calendar month (pending/approved reading exists).',
    )
  }

  await addDoc(readingsRef, {
    flatId,
    imageUrl,
    // OCR is no longer used; keep fields for backwards compatibility.
    ocrReading: null,
    ocrConfidence: null,
    tenantReading: tenantReading ?? null,
    correctedReading: null,
    previousReading: null,
    unitsUsed: null,
    amount: null,
    status: 'pending',
    createdAt: now,
    yearMonth,
  })
}

export async function getTenantReadings(flatId: string): Promise<Reading[]> {
  const readingsRef = collection(db, 'readings')
  // Avoid Firestore composite index requirement by only filtering,
  // then sort by createdAt on the client.
  const q = query(readingsRef, where('flatId', '==', flatId))
  const snapshot = await getDocs(q)
  const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function getPendingReadings(): Promise<Reading[]> {
  const readingsRef = collection(db, 'readings')
  const q = query(readingsRef, where('status', '==', 'pending'))
  const snapshot = await getDocs(q)
  const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function getApprovedReadings(flatId?: string): Promise<Reading[]> {
  const readingsRef = collection(db, 'readings')
  const constraints = [where('status', '==', 'approved')]
  if (flatId) {
    constraints.push(where('flatId', '==', flatId))
  }
  const q = query(readingsRef, ...constraints)
  const snapshot = await getDocs(q)
  const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
  // Sort by approvedAt (fallback to createdAt) on the client.
  return list.sort(
    (a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0),
  )
}

export async function getRejectedReadings(flatId?: string): Promise<Reading[]> {
  const readingsRef = collection(db, 'readings')
  const constraints = [where('status', '==', 'rejected')]
  if (flatId) {
    constraints.push(where('flatId', '==', flatId))
  }
  const q = query(readingsRef, ...constraints)
  const snapshot = await getDocs(q)
  const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
  return list.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  )
}

export function subscribeToPendingReadings(
  callback: (readings: Reading[]) => void,
): () => void {
  const readingsRef = collection(db, 'readings')
  const q = query(readingsRef, where('status', '==', 'pending'))

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
    const sorted = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    callback(sorted)
  })
}

export function subscribeToApprovedReadings(
  callback: (readings: Reading[]) => void,
  flatId?: string,
): () => void {
  const readingsRef = collection(db, 'readings')
  const constraints = [where('status', '==', 'approved')]
  if (flatId) {
    constraints.push(where('flatId', '==', flatId))
  }
  const q = query(readingsRef, ...constraints)

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
    const sorted = list.sort(
      (a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0),
    )
    callback(sorted)
  })
}

export function subscribeToRejectedReadings(
  callback: (readings: Reading[]) => void,
  flatId?: string,
): () => void {
  const readingsRef = collection(db, 'readings')
  const constraints = [where('status', '==', 'rejected')]
  if (flatId) {
    constraints.push(where('flatId', '==', flatId))
  }
  const q = query(readingsRef, ...constraints)

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
    const sorted = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    callback(sorted)
  })
}

export async function approveReading(readingId: string, correctedReading: number) {
  const readingRef = doc(db, 'readings', readingId)
  const snap = await getDoc(readingRef)
  if (!snap.exists()) throw new Error('Reading not found')
  const reading = snap.data() as Reading

  const tariffPerUnit = await getGlobalTariff()
  const minimumPrice = await getMinimumPrice()
  const unitFactor = await getUnitFactor()

  // First, try to find the most recent approved reading for this flat
  // Exclude the current reading being approved
  const prevQuery = query(
    collection(db, 'readings'),
    where('flatId', '==', reading.flatId),
    where('status', '==', 'approved'),
  )
  const prevSnap = await getDocs(prevQuery)
  const prevList = prevSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }))
    .filter((r) => r.id !== readingId) // Exclude the current reading being approved
  const prev = prevList.sort(
    (a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0),
  )[0]

  // If no previous approved reading exists, check for initial reading in flat settings
  let previousReading: number | null = null
  if (prev) {
    // Use correctedReading if available, otherwise fall back to ocrReading
    previousReading = prev.correctedReading ?? prev.ocrReading ?? null
  }

  // If still no previous reading found, check for initial reading in flat settings
  if (previousReading === null) {
    const flat = await getFlatByFlatId(reading.flatId)
    previousReading = flat?.initialReading ?? null
  }

  // Default to 0 if no previous reading found at all
  const finalPreviousReading = previousReading ?? 0

  const rawUnits = correctedReading - finalPreviousReading
  const unitsUsed = rawUnits > 0 ? rawUnits : 0
  // Calculate total KG first (apply unit conversion)
  const totalKg = unitsUsed * unitFactor

  // Calculate energy amount
  const energyAmount = totalKg * tariffPerUnit

  // Grand total is Energy Amount + Minimum Charge (Fixed Standing Charge)
  // This matches the logic in ReceiptModal.tsx
  const amount = energyAmount + minimumPrice
  const approvedAt = Date.now()

  await updateDoc(readingRef, {
    correctedReading,
    previousReading: finalPreviousReading,
    unitsUsed,
    amount,
    status: 'approved',
    approvedAt,
    // Freeze the tariff used for this bill so later tariff changes do not
    // alter historical amounts.
    tariffAtApproval: tariffPerUnit,
    unitFactorAtApproval: unitFactor,
  })
}

export async function rejectReading(readingId: string, reason?: string) {
  const readingRef = doc(db, 'readings', readingId)
  await updateDoc(readingRef, {
    status: 'rejected',
    rejectionReason: reason ?? null,
  })
}

export async function reopenReading(readingId: string, reason?: string) {
  const readingRef = doc(db, 'readings', readingId)
  await updateDoc(readingRef, {
    status: 'pending',
    rejectionReason: null,
    reopenReason: reason ?? null,
    unitsUsed: null,
    amount: null,
    approvedAt: null,
    tariffAtApproval: null,
  })
}

