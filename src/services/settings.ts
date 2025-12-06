import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const SETTINGS_COLLECTION = 'settings'
const GLOBAL_TARIFF_DOC = 'globalTariff'

type GlobalTariffDoc = {
  tariffPerUnit: number
  minimumPrice?: number
  /**
   * Optional global unit conversion factor (e.g. "convitco Kg").
   * This is used when generating receipts so that changes over time
   * are captured per-reading at approval time.
   */
  unitFactor?: number
}

export async function getGlobalTariff(): Promise<number> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    // Default to 0 if not configured yet; admin can set this in the dashboard.
    return 0
  }
  const data = snap.data() as Partial<GlobalTariffDoc>
  return typeof data.tariffPerUnit === 'number' ? data.tariffPerUnit : 0
}

export async function getMinimumPrice(): Promise<number> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    // Default to 250 if not configured yet.
    return 250
  }
  const data = snap.data() as Partial<GlobalTariffDoc>
  return typeof data.minimumPrice === 'number' ? data.minimumPrice : 250
}

export async function getUnitFactor(): Promise<number> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    // Default to 2.3 if not configured yet.
    return 2.3
  }
  const data = snap.data() as Partial<GlobalTariffDoc>
  return typeof data.unitFactor === 'number' ? data.unitFactor : 2.3
}

export async function updateGlobalTariff(tariffPerUnit: number): Promise<void> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  await setDoc(
    ref,
    {
      tariffPerUnit,
    },
    { merge: true },
  )
}

export async function updateMinimumPrice(minimumPrice: number): Promise<void> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  await setDoc(
    ref,
    {
      minimumPrice,
    },
    { merge: true },
  )
}

export async function updateUnitFactor(unitFactor: number): Promise<void> {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_TARIFF_DOC)
  await setDoc(
    ref,
    {
      unitFactor,
    },
    { merge: true },
  )
}





