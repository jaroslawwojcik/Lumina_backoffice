export type EnvironmentName = 'TEST' | 'UAT' | 'PROD'

function readEnvironment(value: string | undefined): EnvironmentName {
  return value === 'UAT' || value === 'PROD' ? value : 'TEST'
}

export const environment = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  name: readEnvironment(import.meta.env.VITE_ENVIRONMENT),
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  },
}

export function isFirebaseConfigured(): boolean { return Object.values(environment.firebase).every((value) => Boolean(value?.trim())) }

export function configurationProblems(): string[] {
  const problems: string[] = []
  try {
    const url = new URL(environment.apiBaseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error()
  } catch { problems.push('VITE_API_BASE_URL — wpisz adres serwera API, np. http://localhost:5236 (bez /api/v1).') }
  const keys = { apiKey: 'VITE_FIREBASE_API_KEY', appId: 'VITE_FIREBASE_APP_ID', authDomain: 'VITE_FIREBASE_AUTH_DOMAIN', projectId: 'VITE_FIREBASE_PROJECT_ID' } as const
  for (const key of Object.keys(keys) as (keyof typeof keys)[]) if (!environment.firebase[key]?.trim()) problems.push(`${keys[key]} — uzupełnij konfigurację aplikacji webowej Firebase.`)
  return problems
}
