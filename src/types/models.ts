export type UserRole = 'tenant' | 'admin'

/**
 * Application-level user used for authentication and authorization.
 * Backed by a Firestore document in the `users` collection.
 * The Firestore document also stores a `passwordHash`, which is intentionally
 * omitted here so it never leaks into UI components.
 */
export interface User {
  id: string
  username: string
  role: UserRole
}

export interface Flat {
  id: string
  flatId: string
  tenantName?: string
  /**
   * Current tariff per unit or per KG for this flat.
   * Admin can update this over time; historic readings store the applied tariff in the Reading itself.
   */
  tariffPerUnit: number
  /**
   * ID of the `users` document that owns this flat.
   */
  userId: string
  /**
   * Initial/starting meter reading for this flat.
   * Used as the previous reading when calculating the first approved reading.
   * Optional - defaults to 0 if not set.
   */
  initialReading?: number | null
}

export interface Reading {
  id: string
  flatId: string
  ocrReading: number | null
  correctedReading: number | null
  previousReading: number | null
  unitsUsed: number | null
  amount: number | null
  imageUrl: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
  approvedAt?: number
  /**
   * Tariff actually used for this reading at approval time.
   * This is frozen so later tariff changes do not affect historic bills.
   */
  tariffAtApproval?: number | null
  /**
   * Unit conversion factor used when this reading was approved
   * (e.g. "convitco Kg"). Stored so receipts remain stable even if
   * the global factor changes later.
   */
  unitFactorAtApproval?: number | null
  /**
   * Calendar year and month of the submission, e.g. "2025-03".
   * Used to enforce one-reading-per-month-per-tenant, unless rejected.
   */
  yearMonth?: string
  ocrConfidence?: number
  rejectionReason?: string
  /**
   * Optional reason provided by admin when re-opening an approved reading.
   */
  reopenReason?: string
}

