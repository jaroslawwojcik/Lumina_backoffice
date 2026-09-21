import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { Permission } from './permissions'

export type AuthState = {
  isLoading: boolean
  user: User | null
  displayName: string | null
  permissions: readonly Permission[]
  staffAccess: 'none' | 'loading' | 'authorized' | 'forbidden' | 'error'
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  retryStaffContext: () => void
}

export const AuthContext = createContext<AuthState | null>(null)
