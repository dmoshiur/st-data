import { app, isConfigured } from '../firebase'
import {
  getFirestore,
  collection as rCollection,
  query as rQuery,
  orderBy as rOrderBy,
  onSnapshot as rOnSnapshot,
  addDoc as rAddDoc,
  updateDoc as rUpdateDoc,
  deleteDoc as rDeleteDoc,
  doc as rDoc,
  serverTimestamp as rServerTimestamp,
} from 'firebase/firestore'
import { demoFirestore } from '../demo'

// Re-exports the Firestore API. When Firebase is configured the real SDK is
// used; otherwise the browser-only demo store is used.
export const db = isConfigured ? getFirestore(app) : demoFirestore

export const collection = isConfigured ? rCollection : demoFirestore.collection
export const query = isConfigured ? rQuery : demoFirestore.query
export const orderBy = isConfigured ? rOrderBy : demoFirestore.orderBy
export const onSnapshot = isConfigured ? rOnSnapshot : demoFirestore.onSnapshot
export const addDoc = isConfigured ? rAddDoc : demoFirestore.addDoc
export const updateDoc = isConfigured ? rUpdateDoc : demoFirestore.updateDoc
export const deleteDoc = isConfigured ? rDeleteDoc : demoFirestore.deleteDoc
export const doc = isConfigured ? rDoc : demoFirestore.doc
export const serverTimestamp = isConfigured ? rServerTimestamp : demoFirestore.serverTimestamp
