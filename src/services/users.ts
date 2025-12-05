import { collection, doc, getDoc, getDocs, query, where, limit, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { User, UserRole } from '../types/models'
import { hashPassword } from './security'

export interface UserDocument extends User {
  passwordHash: string
  flatId?: string | null
  createdAt?: number
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  flatId?: string | null
): Promise<string> {
  const usersRef = collection(db, 'users')
  const passwordHash = await hashPassword(password)
  
  // Check if username already exists
  const existing = await getUserByUsername(username)
  if (existing) {
    throw new Error('Username already exists')
  }
  
  const userDoc = doc(usersRef)
  const userData: Omit<UserDocument, 'id'> = {
    username,
    passwordHash,
    role,
    flatId: flatId ?? null,
    createdAt: Date.now(),
  }
  
  await setDoc(userDoc, userData)
  return userDoc.id
}

export async function getUserByUsername(username: string): Promise<UserDocument | null> {
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('username', '==', username), limit(1))
  const snapshot = await getDocs(q)
  
  if (snapshot.empty) return null
  
  const docSnap = snapshot.docs[0]
  return { id: docSnap.id, ...(docSnap.data() as Omit<UserDocument, 'id'>) }
}

export async function getUserById(userId: string): Promise<User | null> {
  const userRef = doc(db, 'users', userId)
  const snap = await getDoc(userRef)
  
  if (!snap.exists()) return null
  
  const data = snap.data() as Omit<UserDocument, 'id'>
  // Don't return passwordHash
  return {
    id: snap.id,
    username: data.username,
    role: data.role,
  }
}

export async function getAllUsers(): Promise<User[]> {
  const usersRef = collection(db, 'users')
  const snapshot = await getDocs(usersRef)
  
  return snapshot.docs.map((d) => {
    const data = d.data() as Omit<UserDocument, 'id'>
    return {
      id: d.id,
      username: data.username,
      role: data.role,
    }
  })
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const userRef = doc(db, 'users', userId)
  const passwordHash = await hashPassword(newPassword)
  await updateDoc(userRef, { passwordHash })
}

export async function updateUsername(userId: string, newUsername: string): Promise<void> {
  // Check if new username is already taken
  const existing = await getUserByUsername(newUsername)
  if (existing && existing.id !== userId) {
    throw new Error('Username already exists')
  }
  
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, { username: newUsername })
}

export async function deleteUser(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId)
  await deleteDoc(userRef)
}

export async function updateUserFlatId(userId: string, flatId: string | null): Promise<void> {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, { flatId })
}
