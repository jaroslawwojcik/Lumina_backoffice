import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { ApiConnectionStatus } from '../../components/ApiConnectionStatus'
import { useAuth } from '../../auth/useAuth'
import { hasAnyPermission } from '../../auth/permissions'

export function DashboardPage() {
  const { permissions } = useAuth()
  return <Box sx={{ maxWidth: 1080, p: { xs: 2, md: 4 } }}><Typography component="h1" variant="h3">Panel operacyjny</Typography><Stack spacing={3} sx={{ mt: 3 }}><ApiConnectionStatus /><Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}><Typography variant="h6">Dane z API Lumina</Typography><Typography color="text.secondary">Treści, media, produkty i użytkownicy są pobierani z backendu. Puste listy oznaczają brak danych dla wybranych filtrów.</Typography>{hasAnyPermission(permissions, ['content.read']) && <Button component={Link} to="/content" sx={{ alignSelf: 'flex-start' }} variant="contained">Przejdź do treści</Button>}</Stack></Paper></Stack></Box>
}
