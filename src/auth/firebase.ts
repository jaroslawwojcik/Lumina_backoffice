import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { environment, isFirebaseConfigured } from '../app/environment'

export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) return null
  const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp()
  return getAuth(app)
}