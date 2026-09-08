import { app, isConfigured } from '../firebase'
import {
  getDatabase,
  ref as rRef,
  onValue as rOnValue,
  update as rUpdate,
} from 'firebase/database'
import { demoDatabase } from '../demo'

// Re-exports the Realtime Database API. Real SDK when configured, demo store
// otherwise.
export const rtdb = isConfigured ? getDatabase(app) : demoDatabase

export const ref = isConfigured ? rRef : demoDatabase.ref
export const onValue = isConfigured ? rOnValue : demoDatabase.onValue
export const update = isConfigured ? rUpdate : demoDatabase.update
