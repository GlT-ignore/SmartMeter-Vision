import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Flat } from '../types/models'

export async function getFlatByUserId(userId: string): Promise<Flat | null> {
  const flatsRef = collection(db, 'flats')
  const q = query(flatsRef, where('userId', '==', userId), limit(1))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const docSnap = snapshot.docs[0]
  return { id: docSnap.id, ...(docSnap.data() as Omit<Flat, 'id'>) }
}

export async function getFlatById(flatId: string): Promise<Flat | null> {
  const flatRef = doc(db, 'flats', flatId)
  const snap = await getDoc(flatRef)
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Flat, 'id'>) }
}

export async function getFlatByFlatId(flatId: string): Promise<Flat | null> {
  const flatsRef = collection(db, 'flats')
  const q = query(flatsRef, where('flatId', '==', flatId), limit(1))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const docSnap = snapshot.docs[0]
  return { id: docSnap.id, ...(docSnap.data() as Omit<Flat, 'id'>) }
}

export async function getAllFlats(): Promise<Flat[]> {
  const flatsRef = collection(db, 'flats')
  const snapshot = await getDocs(flatsRef)
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Flat, 'id'>) }))
}

export type NewFlatInput = {
  flatId: string
  ownerName?: string
  tariffPerUnit: number
  userId: string
  initialReading?: number | null
}

export async function createFlat(data: NewFlatInput): Promise<string> {
  const flatsRef = collection(db, 'flats')
  const { flatId, ...rest } = data
  const flatDocRef = doc(flatsRef, flatId)
  await setDoc(flatDocRef, {
    flatId,
    ...rest,
  })
  return flatId
}

export async function updateFlat(id: string, data: Partial<Omit<Flat, 'id'>>): Promise<void> {
  const flatRef = doc(db, 'flats', id)
  await updateDoc(flatRef, data)
}

