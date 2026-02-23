import { useEffect, useState } from 'react'
import type { User } from '../types/models'
import { getUserByUsername } from './users'
import { verifyPassword } from './security'

const STORAGE_KEY = 'smartmeter_current_user'

export async function login(username: string, password: string): Promise<User> {
  const userDoc = await getUserByUsername(username)

  if (!userDoc) {
    throw new Error('Invalid username or password')
  }

  const isValid = await verifyPassword(password, userDoc.passwordHash)

  if (!isValid) {
    throw new Error('Invalid username or password')
  }

  // Store user in localStorage (without password hash)
  const user: User = {
    id: userDoc.id,
    username: userDoc.username,
    role: userDoc.role,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))

  return user
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getCurrentUser(): User | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(getCurrentUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  return { user, loading }
}

