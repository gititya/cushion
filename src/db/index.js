/**
 * DAL -- Database Abstraction Layer
 *
 * THIS IS THE ONLY FILE IN THE CODEBASE THAT IMPORTS FIREBASE.
 * All Firestore reads and writes go through this file.
 * All encryption/decryption happens here -- components never handle crypto.
 *
 * Encryption key is read from sessionStorage (set at login via AuthContext).
 * Key source (OS keychain, Proton Pass, etc.) is a UX concern -- not in this file.
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
// ---------------------------------------------------------------------------
// Firebase init -- config from .env.local (gitignored)
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
export const auth = getAuth(app)

// Persist auth session across browser closes
setPersistence(auth, browserLocalPersistence)

// ---------------------------------------------------------------------------
// Auth API (exposed so nothing else imports firebase/auth directly)
// ---------------------------------------------------------------------------

export const authAPI = {
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  signOut: () => signOut(auth),
  onStateChanged: (callback) => onAuthStateChanged(auth, callback),
}

// ---------------------------------------------------------------------------
// Shared query helper
// ---------------------------------------------------------------------------

function userQuery(collectionName, uid, ...constraints) {
  return query(
    collection(db, collectionName),
    where('userId', '==', uid),
    ...constraints
  )
}

async function getAll(collectionName, uid, ...constraints) {
  const q = userQuery(collectionName, uid, ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ---------------------------------------------------------------------------
// cushion_categories
// ---------------------------------------------------------------------------

export const categories = {
  async getAll(uid) {
    const docs = await getAll('cushion_categories', uid, orderBy('sortOrder'))
    return docs
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_categories'), {
      userId: uid,
      name: data.name,
      icon: data.icon ?? null,
      color: data.color ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_categories', docId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_categories', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_expenses
// ---------------------------------------------------------------------------

export const expenses = {
  async getAll(uid) {
    return getAll('cushion_expenses', uid, orderBy('date', 'desc'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_expenses'), {
      userId: uid,
      date: data.date,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      cardId: data.cardId ?? null,
      tripId: data.tripId ?? null,
      importedFrom: data.importedFrom ?? null,
      amount: data.amount,
      description: data.description ?? null,
      notes: data.notes ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_expenses', docId), {
      date: data.date,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      cardId: data.cardId ?? null,
      amount: data.amount,
      description: data.description ?? null,
      notes: data.notes ?? null,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_expenses', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_income
// ---------------------------------------------------------------------------

export const income = {
  async getAll(uid) {
    return getAll('cushion_income', uid, orderBy('date', 'desc'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_income'), {
      userId: uid,
      date: data.date,
      amount: data.amount,
      source: data.source,
      notes: data.notes ?? null,
      importedFrom: data.importedFrom ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_income', docId), {
      date: data.date,
      amount: data.amount,
      source: data.source,
      notes: data.notes ?? null,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_income', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_recurring_items
// ---------------------------------------------------------------------------

export const recurringItems = {
  async getAll(uid) {
    return getAll('cushion_recurring_items', uid, orderBy('nextDueDate'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_recurring_items'), {
      userId: uid,
      type: data.type,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      name: data.name,
      amount: data.amount,
      reminderDaysBefore: data.reminderDaysBefore ?? null,
      isActive: data.isActive ?? true,
      notes: data.notes ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_recurring_items', docId), {
      type: data.type,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      name: data.name,
      amount: data.amount,
      reminderDaysBefore: data.reminderDaysBefore ?? null,
      isActive: data.isActive,
      notes: data.notes ?? null,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_recurring_items', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_investments
// ---------------------------------------------------------------------------

export const investments = {
  async getAll(uid) {
    return getAll('cushion_investments', uid, orderBy('startDate', 'desc'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_investments'), {
      userId: uid,
      type: data.type,
      platform: data.platform,
      name: data.name,
      amountInvested: data.amountInvested,
      currentValue: data.currentValue ?? null,
      returnsPercent: data.returnsPercent ?? null,
      startDate: data.startDate,
      maturityDate: data.maturityDate ?? null,
      notes: data.notes ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_investments', docId), {
      type: data.type,
      platform: data.platform,
      name: data.name,
      amountInvested: data.amountInvested,
      currentValue: data.currentValue ?? null,
      returnsPercent: data.returnsPercent ?? null,
      startDate: data.startDate,
      maturityDate: data.maturityDate ?? null,
      notes: data.notes ?? null,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_investments', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_loans
// ---------------------------------------------------------------------------

export const loans = {
  async getAll(uid) {
    return getAll('cushion_loans', uid, orderBy('dateGiven', 'desc'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_loans'), {
      userId: uid,
      dateGiven: data.dateGiven,
      expectedReturnDate: data.expectedReturnDate,
      person: data.person,
      amount: data.amount,
      notes: data.notes ?? null,
      isReturned: data.isReturned ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_loans', docId), {
      dateGiven: data.dateGiven,
      expectedReturnDate: data.expectedReturnDate,
      person: data.person,
      amount: data.amount,
      notes: data.notes ?? null,
      isReturned: data.isReturned,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_loans', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_credit_cards
// No encrypted fields (no card numbers stored -- PRD rule)
// ---------------------------------------------------------------------------

export const creditCards = {
  async getAll(uid) {
    return getAll('cushion_credit_cards', uid)
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_credit_cards'), {
      userId: uid,
      name: data.name,
      network: data.network,
      cashbackCategories: data.cashbackCategories ?? [],
      rewardPointsRate: data.rewardPointsRate ?? null,
      travelBenefits: data.travelBenefits ?? null,
      onlineOfflineBenefits: data.onlineOfflineBenefits ?? null,
      isActive: data.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_credit_cards', docId), {
      name: data.name,
      network: data.network,
      cashbackCategories: data.cashbackCategories ?? [],
      rewardPointsRate: data.rewardPointsRate ?? null,
      travelBenefits: data.travelBenefits ?? null,
      onlineOfflineBenefits: data.onlineOfflineBenefits ?? null,
      isActive: data.isActive,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_credit_cards', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_emis
// ---------------------------------------------------------------------------

export const emis = {
  async getAll(uid) {
    return getAll('cushion_emis', uid, orderBy('monthsRemaining'))
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_emis'), {
      userId: uid,
      cardId: data.cardId,
      monthsRemaining: data.monthsRemaining,
      startDate: data.startDate,
      merchant: data.merchant,
      emiAmount: data.emiAmount,
      notes: data.notes ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_emis', docId), {
      cardId: data.cardId,
      monthsRemaining: data.monthsRemaining,
      startDate: data.startDate,
      merchant: data.merchant,
      emiAmount: data.emiAmount,
      notes: data.notes ?? null,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_emis', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_budgets
// ---------------------------------------------------------------------------

export const budgets = {
  async getAll(uid) {
    return getAll('cushion_budgets', uid)
  },

  async add(uid, data) {
    return addDoc(collection(db, 'cushion_budgets'), {
      userId: uid,
      categoryId: data.categoryId,
      monthlyLimit: data.monthlyLimit,
      alertAt80: data.alertAt80 ?? true,
      alertAt100: data.alertAt100 ?? true,
      isActive: data.isActive ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    return updateDoc(doc(db, 'cushion_budgets', docId), {
      categoryId: data.categoryId,
      monthlyLimit: data.monthlyLimit,
      alertAt80: data.alertAt80,
      alertAt100: data.alertAt100,
      isActive: data.isActive,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_budgets', docId))
  },
}
