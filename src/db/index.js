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
import CryptoJS from 'crypto-js'

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
// Encryption helpers
// Keys stored in sessionStorage under 'cushion_enc_key'.
// Set by AuthContext after the user provides their key at login.
// ---------------------------------------------------------------------------

const SESSION_KEY_NAME = 'cushion_enc_key'

function getEncKey() {
  const key = sessionStorage.getItem(SESSION_KEY_NAME)
  if (!key) throw new Error('Encryption key not set. Please log in again.')
  return key
}

export function setEncKey(key) {
  sessionStorage.setItem(SESSION_KEY_NAME, key)
}

export function clearEncKey() {
  sessionStorage.removeItem(SESSION_KEY_NAME)
}

function encrypt(value) {
  if (value === null || value === undefined) return value
  const key = getEncKey()
  return CryptoJS.AES.encrypt(String(value), key).toString()
}

function decrypt(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return ciphertext
  const key = getEncKey()
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  return bytes.toString(CryptoJS.enc.Utf8)
}

function decryptNumber(ciphertext) {
  const raw = decrypt(ciphertext)
  return raw !== null && raw !== undefined ? parseFloat(raw) : null
}

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
// Encrypted fields: amount, description, notes
// ---------------------------------------------------------------------------

function encryptExpense(data) {
  return {
    amount: encrypt(data.amount),
    description: data.description ? encrypt(data.description) : null,
    notes: data.notes ? encrypt(data.notes) : null,
  }
}

function decryptExpense(raw) {
  return {
    ...raw,
    amount: decryptNumber(raw.amount),
    description: raw.description ? decrypt(raw.description) : null,
    notes: raw.notes ? decrypt(raw.notes) : null,
  }
}

export const expenses = {
  async getAll(uid) {
    const docs = await getAll('cushion_expenses', uid, orderBy('date', 'desc'))
    return docs.map(decryptExpense)
  },

  async add(uid, data) {
    const encrypted = encryptExpense(data)
    return addDoc(collection(db, 'cushion_expenses'), {
      userId: uid,
      date: data.date,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      cardId: data.cardId ?? null,
      tripId: data.tripId ?? null,
      importedFrom: data.importedFrom ?? null,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptExpense(data)
    return updateDoc(doc(db, 'cushion_expenses', docId), {
      date: data.date,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      cardId: data.cardId ?? null,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_expenses', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_income
// Encrypted fields: amount, source, notes
// ---------------------------------------------------------------------------

function encryptIncome(data) {
  return {
    amount: encrypt(data.amount),
    source: encrypt(data.source),
    notes: data.notes ? encrypt(data.notes) : null,
  }
}

function decryptIncome(raw) {
  return {
    ...raw,
    amount: decryptNumber(raw.amount),
    source: decrypt(raw.source),
    notes: raw.notes ? decrypt(raw.notes) : null,
  }
}

export const income = {
  async getAll(uid) {
    const docs = await getAll('cushion_income', uid, orderBy('date', 'desc'))
    return docs.map(decryptIncome)
  },

  async add(uid, data) {
    const encrypted = encryptIncome(data)
    return addDoc(collection(db, 'cushion_income'), {
      userId: uid,
      date: data.date,
      importedFrom: data.importedFrom ?? null,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptIncome(data)
    return updateDoc(doc(db, 'cushion_income', docId), {
      date: data.date,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_income', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_recurring_items
// Encrypted fields: name, amount
// ---------------------------------------------------------------------------

function encryptRecurring(data) {
  return {
    name: encrypt(data.name),
    amount: encrypt(data.amount),
  }
}

function decryptRecurring(raw) {
  return {
    ...raw,
    name: decrypt(raw.name),
    amount: decryptNumber(raw.amount),
  }
}

export const recurringItems = {
  async getAll(uid) {
    const docs = await getAll('cushion_recurring_items', uid, orderBy('nextDueDate'))
    return docs.map(decryptRecurring)
  },

  async add(uid, data) {
    const encrypted = encryptRecurring(data)
    return addDoc(collection(db, 'cushion_recurring_items'), {
      userId: uid,
      type: data.type,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      reminderDaysBefore: data.reminderDaysBefore ?? null,
      isActive: data.isActive ?? true,
      notes: data.notes ?? null,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptRecurring(data)
    return updateDoc(doc(db, 'cushion_recurring_items', docId), {
      type: data.type,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      reminderDaysBefore: data.reminderDaysBefore ?? null,
      isActive: data.isActive,
      notes: data.notes ?? null,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_recurring_items', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_investments
// Encrypted fields: name, amountInvested, currentValue
// ---------------------------------------------------------------------------

function encryptInvestment(data) {
  return {
    name: encrypt(data.name),
    amountInvested: encrypt(data.amountInvested),
    currentValue: data.currentValue != null ? encrypt(data.currentValue) : null,
  }
}

function decryptInvestment(raw) {
  return {
    ...raw,
    name: decrypt(raw.name),
    amountInvested: decryptNumber(raw.amountInvested),
    currentValue: raw.currentValue ? decryptNumber(raw.currentValue) : null,
  }
}

export const investments = {
  async getAll(uid) {
    const docs = await getAll('cushion_investments', uid, orderBy('startDate', 'desc'))
    return docs.map(decryptInvestment)
  },

  async add(uid, data) {
    const encrypted = encryptInvestment(data)
    return addDoc(collection(db, 'cushion_investments'), {
      userId: uid,
      type: data.type,
      platform: data.platform,
      returnsPercent: data.returnsPercent ?? null,
      startDate: data.startDate,
      maturityDate: data.maturityDate ?? null,
      notes: data.notes ?? null,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptInvestment(data)
    return updateDoc(doc(db, 'cushion_investments', docId), {
      type: data.type,
      platform: data.platform,
      returnsPercent: data.returnsPercent ?? null,
      startDate: data.startDate,
      maturityDate: data.maturityDate ?? null,
      notes: data.notes ?? null,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_investments', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_loans
// Encrypted fields: person, amount, notes
// ---------------------------------------------------------------------------

function encryptLoan(data) {
  return {
    person: encrypt(data.person),
    amount: encrypt(data.amount),
    notes: data.notes ? encrypt(data.notes) : null,
  }
}

function decryptLoan(raw) {
  return {
    ...raw,
    person: decrypt(raw.person),
    amount: decryptNumber(raw.amount),
    notes: raw.notes ? decrypt(raw.notes) : null,
  }
}

export const loans = {
  async getAll(uid) {
    const docs = await getAll('cushion_loans', uid, orderBy('dateGiven', 'desc'))
    return docs.map(decryptLoan)
  },

  async add(uid, data) {
    const encrypted = encryptLoan(data)
    return addDoc(collection(db, 'cushion_loans'), {
      userId: uid,
      dateGiven: data.dateGiven,
      expectedReturnDate: data.expectedReturnDate,
      isReturned: data.isReturned ?? false,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptLoan(data)
    return updateDoc(doc(db, 'cushion_loans', docId), {
      dateGiven: data.dateGiven,
      expectedReturnDate: data.expectedReturnDate,
      isReturned: data.isReturned,
      ...encrypted,
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
// Encrypted fields: merchant, emiAmount
// ---------------------------------------------------------------------------

function encryptEmi(data) {
  return {
    merchant: encrypt(data.merchant),
    emiAmount: encrypt(data.emiAmount),
  }
}

function decryptEmi(raw) {
  return {
    ...raw,
    merchant: decrypt(raw.merchant),
    emiAmount: decryptNumber(raw.emiAmount),
  }
}

export const emis = {
  async getAll(uid) {
    const docs = await getAll('cushion_emis', uid, orderBy('monthsRemaining'))
    return docs.map(decryptEmi)
  },

  async add(uid, data) {
    const encrypted = encryptEmi(data)
    return addDoc(collection(db, 'cushion_emis'), {
      userId: uid,
      cardId: data.cardId,
      monthsRemaining: data.monthsRemaining,
      startDate: data.startDate,
      notes: data.notes ?? null,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptEmi(data)
    return updateDoc(doc(db, 'cushion_emis', docId), {
      cardId: data.cardId,
      monthsRemaining: data.monthsRemaining,
      startDate: data.startDate,
      notes: data.notes ?? null,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_emis', docId))
  },
}

// ---------------------------------------------------------------------------
// cushion_budgets
// Encrypted fields: monthlyLimit
// ---------------------------------------------------------------------------

function encryptBudget(data) {
  return { monthlyLimit: encrypt(data.monthlyLimit) }
}

function decryptBudget(raw) {
  return { ...raw, monthlyLimit: decryptNumber(raw.monthlyLimit) }
}

export const budgets = {
  async getAll(uid) {
    const docs = await getAll('cushion_budgets', uid)
    return docs.map(decryptBudget)
  },

  async add(uid, data) {
    const encrypted = encryptBudget(data)
    return addDoc(collection(db, 'cushion_budgets'), {
      userId: uid,
      categoryId: data.categoryId,
      alertAt80: data.alertAt80 ?? true,
      alertAt100: data.alertAt100 ?? true,
      isActive: data.isActive ?? true,
      ...encrypted,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async update(docId, data) {
    const encrypted = encryptBudget(data)
    return updateDoc(doc(db, 'cushion_budgets', docId), {
      categoryId: data.categoryId,
      alertAt80: data.alertAt80,
      alertAt100: data.alertAt100,
      isActive: data.isActive,
      ...encrypted,
      updatedAt: serverTimestamp(),
    })
  },

  async remove(docId) {
    return deleteDoc(doc(db, 'cushion_budgets', docId))
  },
}
