import type { User } from '../types'

const DEMO_EMAILS = new Set(['admin@grooflow.com', 'admin@vetflow.com'])
const DEMO_PASSWORD = '123456'

export const LOCAL_DEMO_SESSION_KEY = 'grooflow_local_session'
export const LOCAL_DEMO_SESSION_EMAIL_KEY = 'grooflow_local_session_email'

export type DemoLoginEnv = {
  prod: boolean
  dev: boolean
  backend: string
  allowDemoLogin: boolean
}

export function readDemoLoginEnv(): DemoLoginEnv {
  return {
    prod: import.meta.env.PROD,
    dev: import.meta.env.DEV,
    backend: import.meta.env.VITE_BACKEND ?? 'rest',
    allowDemoLogin: import.meta.env.VITE_ALLOW_DEMO_LOGIN === 'true',
  }
}

/** Login demo offline: solo desarrollo o backend local explícito. Nunca en build de producción. */
export function isDemoLoginEnabled(env: DemoLoginEnv = readDemoLoginEnv()): boolean {
  if (env.prod) return false
  if (env.backend === 'local') return true
  if (env.dev && env.allowDemoLogin) return true
  return false
}

export function tryDemoLogin(
  email: string,
  password: string,
  env: DemoLoginEnv = readDemoLoginEnv()
): boolean {
  if (!isDemoLoginEnabled(env)) return false
  const normalized = email.trim().toLowerCase()
  return DEMO_EMAILS.has(normalized) && password === DEMO_PASSWORD
}

export function isLocalDemoSessionActive(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(LOCAL_DEMO_SESSION_KEY) === '1'
}

export function beginLocalDemoSession(email: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(LOCAL_DEMO_SESSION_KEY, '1')
  window.sessionStorage.setItem(LOCAL_DEMO_SESSION_EMAIL_KEY, email.trim().toLowerCase())
}

export function clearLocalDemoSession(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(LOCAL_DEMO_SESSION_KEY)
  window.sessionStorage.removeItem(LOCAL_DEMO_SESSION_EMAIL_KEY)
}

export function getLocalDemoSessionEmail(): string | null {
  if (typeof window === 'undefined') return null
  const email = window.sessionStorage.getItem(LOCAL_DEMO_SESSION_EMAIL_KEY)?.trim().toLowerCase()
  return email || null
}

/** Usuario admin semilla para modo local sin `data:users` previo. */
export function createLocalDemoAdminUser(email = 'admin@grooflow.com'): User {
  const normalized = email.trim().toLowerCase() || 'admin@grooflow.com'
  return {
    id: 'local-demo-admin',
    name: 'Admin Principal',
    initials: 'AP',
    email: normalized,
    role: 'super_admin',
    status: 'active',
    allSedes: true,
    lastLogin: new Date().toISOString(),
  }
}
