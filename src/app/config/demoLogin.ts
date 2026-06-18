const DEMO_EMAILS = new Set(['admin@grooflow.com', 'admin@vetflow.com'])
const DEMO_PASSWORD = '123456'

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
    backend: import.meta.env.VITE_BACKEND ?? 'supabase',
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
