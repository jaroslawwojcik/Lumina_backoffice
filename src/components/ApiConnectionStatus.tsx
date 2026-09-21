import { Alert, Button } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { environment } from '../app/environment'

export function ApiConnectionStatus() {
  const query = useQuery({ queryKey: ['api-health', environment.apiBaseUrl], enabled: Boolean(environment.apiBaseUrl), retry: false, queryFn: async ({ signal }) => {
    const response = await fetch(new URL('/health/ready', environment.apiBaseUrl), { signal, redirect: 'error' })
    if (!response.ok) throw new Error('API is not ready.')
    return true
  } })
  if (!environment.apiBaseUrl) return null
  if (query.isPending) return <Alert severity="info">Sprawdzanie połączenia z API…</Alert>
  if (query.isError) return <Alert severity="error" action={<Button color="inherit" onClick={() => void query.refetch()}>Sprawdź ponownie</Button>}>API jest niedostępne: {environment.apiBaseUrl}. Sprawdź uruchomienie backendu, bazę danych i CORS.</Alert>
  return <Alert severity="success">Połączono z API: {environment.apiBaseUrl}</Alert>
}
