import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth } from './firebase'

const STORAGE_KEY = 'smartmeter_super_user'
const SUPER_USER_EMAIL = import.meta.env.VITE_SUPER_USER_EMAIL || ''

export interface SuperUser {
  email: string
  name: string
  photoURL?: string
}

/**
 * Login super user using Google OAuth
 * Only allows login if the email matches the configured super user email
 */
export async function loginSuperUser(): Promise<SuperUser> {
  if (!SUPER_USER_EMAIL) {
    throw new Error('Super user email not configured. Please set VITE_SUPER_USER_EMAIL in your .env file.')
  }

  // Check if auth is properly initialized
  if (!auth || !auth.app) {
    throw new Error(
      'Firebase Authentication is not initialized. Please check your Firebase configuration and ensure ' +
      'VITE_FIREBASE_AUTH_DOMAIN is set correctly in your .env file.'
    )
  }

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account'
  })

  try {
    const result = await signInWithPopup(auth, provider)
    const user = result.user

    // Verify that the logged-in user is the authorized super user
    if (user.email?.toLowerCase() !== SUPER_USER_EMAIL.toLowerCase()) {
      await firebaseSignOut(auth)
      throw new Error(`Access denied. Only ${SUPER_USER_EMAIL} is authorized as super user.`)
    }

    const superUser: SuperUser = {
      email: user.email!,
      name: user.displayName || user.email!,
      photoURL: user.photoURL || undefined,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(superUser))
    return superUser
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled')
    }
    if (error.code === 'auth/configuration-not-found') {
      throw new Error(
        'Firebase Authentication is not configured. Please enable Google Sign-In in Firebase Console: ' +
        '1. Go to Firebase Console → Authentication → Sign-in method, ' +
        '2. Enable Google provider, ' +
        '3. Add your domain to authorized domains.'
      )
    }
    if (error.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google Sign-In is not enabled. Please enable it in Firebase Console: ' +
        'Firebase Console → Authentication → Sign-in method → Google → Enable'
      )
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error(
        'This domain is not authorized. Please add it to authorized domains in Firebase Console: ' +
        'Firebase Console → Authentication → Settings → Authorized domains'
      )
    }
    // Provide a more helpful error message for other auth errors
    if (error.code?.startsWith('auth/')) {
      throw new Error(`Authentication error: ${error.message || error.code}`)
    }
    throw error
  }
}

/**
 * Logout super user
 */
export function logoutSuperUser(): void {
  localStorage.removeItem(STORAGE_KEY)
  firebaseSignOut(auth).catch(console.error)
}

/**
 * Get current super user from localStorage
 */
export function getCurrentSuperUser(): SuperUser | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  
  try {
    return JSON.parse(stored) as SuperUser
  } catch {
    return null
  }
}

/**
 * Check if current Firebase auth user is the super user
 */
export function isSuperUserAuthenticated(): boolean {
  return getCurrentSuperUser() !== null
}
