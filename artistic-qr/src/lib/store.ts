import { useSyncExternalStore } from 'react'

export type Contact = {
  id: string
  name: string
  vpa: string
  color: string
}

export type Txn = {
  id: string
  direction: 'sent' | 'received'
  name: string
  vpa: string
  amount: number
  note?: string
  ts: number
  method: 'veil' | 'upi'
}

export type Account = {
  name: string
  vpa: string
  balance: number
}

export type AppState = {
  account: Account
  contacts: Contact[]
  txns: Txn[]
}

const KEY = 'veil.pay.v1'

const AVATAR_COLORS = [
  '#e07a3d',
  '#2f6f6a',
  '#7ec8c0',
  '#c45c26',
  '#5e7a92',
  '#a0693d',
  '#6b8e6b',
  '#8a5a9c',
]

export function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function seedState(): AppState {
  const contacts: Contact[] = [
    { id: 'c1', name: 'Aarav Sharma', vpa: 'aarav@okhdfc', color: colorFor('Aarav Sharma') },
    { id: 'c2', name: 'Priya Nair', vpa: 'priya@okaxis', color: colorFor('Priya Nair') },
    { id: 'c3', name: 'Rohan Mehta', vpa: 'rohan@oksbi', color: colorFor('Rohan Mehta') },
    { id: 'c4', name: 'Diya Patel', vpa: 'diya@okicici', color: colorFor('Diya Patel') },
    { id: 'c5', name: 'Kabir Singh', vpa: 'kabir@ybl', color: colorFor('Kabir Singh') },
  ]

  const now = Date.now()
  const txns: Txn[] = [
    {
      id: 't1',
      direction: 'received',
      name: 'Priya Nair',
      vpa: 'priya@okaxis',
      amount: 500,
      note: 'Split dinner',
      ts: now - 1000 * 60 * 60 * 5,
      method: 'upi',
    },
    {
      id: 't2',
      direction: 'sent',
      name: 'Rohan Mehta',
      vpa: 'rohan@oksbi',
      amount: 149,
      note: 'Movie',
      ts: now - 1000 * 60 * 60 * 26,
      method: 'veil',
    },
    {
      id: 't3',
      direction: 'sent',
      name: 'Aarav Sharma',
      vpa: 'aarav@okhdfc',
      amount: 1200,
      note: 'Rent share',
      ts: now - 1000 * 60 * 60 * 50,
      method: 'upi',
    },
  ]

  return {
    account: { name: 'Smit Gaikwad', vpa: 'smit@veil', balance: 24500 },
    contacts,
    txns,
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* ignore */
  }
  const seeded = seedState()
  save(seeded)
  return seeded
}

function save(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function emit() {
  save(state)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, () => state)
}

export function recordPayment(input: {
  direction: 'sent' | 'received'
  name: string
  vpa: string
  amount: number
  note?: string
  method: 'veil' | 'upi'
}): Txn {
  const txn: Txn = { id: `t${Date.now()}`, ts: Date.now(), ...input }
  const delta = input.direction === 'sent' ? -input.amount : input.amount
  state = {
    ...state,
    account: { ...state.account, balance: state.account.balance + delta },
    txns: [txn, ...state.txns],
    contacts: upsertContact(state.contacts, input.name, input.vpa),
  }
  emit()
  return txn
}

function upsertContact(contacts: Contact[], name: string, vpa: string): Contact[] {
  if (!vpa || contacts.some((c) => c.vpa === vpa)) return contacts
  const contact: Contact = { id: `c${Date.now()}`, name: name || vpa, vpa, color: colorFor(vpa) }
  return [contact, ...contacts]
}

export function resetDemo() {
  state = seedState()
  emit()
}
