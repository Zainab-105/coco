'use client'

import { useSyncExternalStore } from 'react'

/**
 * Minimal localStorage-backed store with cross-tab sync. Server render and first client
 * render use `initial`, so markup always hydrates; stored state appears right after.
 */
export function createPersistentStore<T>(key: string, initial: T) {
  let state = initial
  let loaded = false
  const listeners = new Set<() => void>()

  const read = () => {
    if (loaded || typeof window === 'undefined') return
    loaded = true
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) state = JSON.parse(raw) as T
    } catch {
      // Private mode or corrupted value: start fresh.
    }
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return
      try {
        state = e.newValue ? (JSON.parse(e.newValue) as T) : initial
      } catch {
        state = initial
      }
      listeners.forEach((l) => l())
    })
  }

  const set = (next: T | ((prev: T) => T)) => {
    read()
    state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Storage full or unavailable: keep in memory only.
    }
    listeners.forEach((l) => l())
  }

  const subscribe = (listener: () => void) => {
    read()
    listeners.add(listener)
    // Stored state may differ from the hydration snapshot; notify once loaded.
    queueMicrotask(listener)
    return () => listeners.delete(listener)
  }

  const get = () => {
    read()
    return state
  }

  const useStore = () => useSyncExternalStore(subscribe, get, () => initial)

  return { get, set, subscribe, useStore }
}
