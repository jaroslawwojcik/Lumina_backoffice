import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isFirebaseConfigured } from '../app/environment'
import { ApiError } from '../api/apiError'
import { fetchAdminMe } from './adminMe'
import { AuthContext, type AuthState } from './authContext'
import { getFirebaseAuth } from './firebase'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured())
  const previousUid = useRef<string | null>(null)
  const client = useQueryClient()
  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) return
    return onAuthStateChanged(auth, (nextUser) => {
      if (previousUid.current !== (nextUser?.uid ?? null)) client.clear()
      previousUid.current = nextUser?.uid ?? null
      setUser(nextUser)
      setIsLoading(false)
    })
  }, [client])
  const staffQuery = useQuery({ queryKey: ['admin', 'me', user?.uid], queryFn: fetchAdminMe, enabled: Boolean(user), retry: false })
  const staffAccess = !user ? 'none' : staffQuery.isPending ? 'loading'
    : staffQuery.isError && staffQuery.error instanceof ApiError && staffQuery.error.status === 403 ? 'forbidden'
      : staffQuery.isError ? 'error' : 'authorized'
  const value: AuthState = {
    isLoading: isLoading || staffAccess === 'loading', user,
    displayName: staffQuery.data?.displayName ?? user?.displayName ?? null,
    permissions: staffAccess === 'authorized' ? staffQuery.data?.effectivePermissions ?? [] : [], staffAccess,
    signIn: async () => {
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase configuration is unavailable.')
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    signOut: async () => { const auth = getFirebaseAuth(); if (auth) await signOut(auth); client.clear() },
    retryStaffContext: () => { void staffQuery.refetch() },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
