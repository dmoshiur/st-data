import { app, isConfigured } from '../firebase'
import {
  getAuth,
  signInWithEmailAndPassword as rSignIn,
  sendPasswordResetEmail as rReset,
  onAuthStateChanged as rOnAuth,
  signOut as rSignOut,
} from 'firebase/auth'
import { demoAuth } from '../demo'

// Re-exports the Auth API. Real SDK when configured, demo auth otherwise.
export const auth = isConfigured ? getAuth(app) : demoAuth

export const signInWithEmailAndPassword = isConfigured
  ? rSignIn
  : demoAuth.signInWithEmailAndPassword
export const sendPasswordResetEmail = isConfigured
  ? rReset
  : demoAuth.sendPasswordResetEmail
export const onAuthStateChanged = isConfigured ? rOnAuth : demoAuth.onAuthStateChanged
export const signOut = isConfigured ? rSignOut : demoAuth.signOut
