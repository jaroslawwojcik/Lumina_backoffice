import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { configurationProblems } from '../../app/environment'
import { useAuth } from '../../auth/useAuth'
import { ApiConnectionStatus } from '../../components/ApiConnectionStatus'

export function LoginPage() {
  const { signIn, user } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const pathname = from?.pathname
  const destination = pathname?.startsWith('/') && !pathname.startsWith('//') && pathname !== '/login' ? pathname + (from?.search ?? '') : '/'
  if (user) return <Navigate replace to={destination} />
  const problems = configurationProblems()
  const login = async () => {
    setError(''); setPending(true)
    try { await signIn() }
    catch { setError('Nie udało się zalogować. Sprawdź konfigurację Firebase, włączenie logowania Google i dozwoloną domenę aplikacji.') }
    finally { setPending(false) }
  }
  return <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'center', minHeight: '100vh', p: 3 }}><Paper variant="outlined" sx={{ maxWidth: 620, p: 4, width: '100%' }}><Stack spacing={3}>
    <Box><Typography color="primary" sx={{ fontWeight: 700, letterSpacing: 1.5 }} variant="h5">LUMINA</Typography><Typography component="h1" variant="h4">Panel operacyjny</Typography></Box>
    {problems.length > 0 ? <Alert severity="warning"><Typography>Uzupełnij plik Lumina_backoffice/.env.local i uruchom ponownie serwer aplikacji.</Typography>{problems.map((problem) => <Typography key={problem} sx={{ mt: 1 }}>{problem}</Typography>)}</Alert> : <ApiConnectionStatus />}
    <Typography color="text.secondary">Zaloguj się kontem Google uprawnionym do administracji w projekcie Firebase używanym przez API.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Button disabled={problems.length > 0 || pending} onClick={() => void login()} size="large" variant="contained">{pending ? 'Logowanie…' : 'Zaloguj się przez Google'}</Button>
  </Stack></Paper></Box>
}
