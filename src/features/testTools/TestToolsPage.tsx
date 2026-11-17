import ScienceOutlined from '@mui/icons-material/ScienceOutlined'
import { Alert, AlertTitle, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { environment } from '../../app/environment'
import { UserPicker } from '../users/UserPicker'
import { apiErrorMessage, type PickedUser } from '../users/userFormat'
import { ClearAccessCard } from './ClearAccessCard'
import { CreateTestUserCard } from './CreateTestUserCard'
import { SimulatePurchaseCard } from './SimulatePurchaseCard'
import { SimulateSubscriptionCard } from './SimulateSubscriptionCard'
import { useTestToolsAvailability } from './testToolsAvailability'
import { ToolCard } from './ToolCard'

export function TestToolsPage() {
  const availability = useTestToolsAvailability()
  const [user, setUser] = useState<PickedUser | null>(null)
  return <Box sx={{ maxWidth: 1100, p: { xs: 2, sm: 4 } }}>
    <Typography component="h1" variant="h3">Narzędzia testowe</Typography>
    <Typography color="text.secondary" sx={{ mb: 3, mt: 1 }}>Przygotowanie kont i scenariuszy zakupowych do testów aplikacji.</Typography>
    {availability.state === 'production' && <Alert severity="error">Narzędzia testowe są niedostępne w środowisku produkcyjnym.</Alert>}
    {availability.state === 'checking' && <Alert icon={<CircularProgress size={20} />} role="status" severity="info">Sprawdzanie dostępności narzędzi testowych...</Alert>}
    {availability.state === 'enabled' && <Alert icon={<ScienceOutlined />} severity="warning" sx={{ mb: 3 }} variant="filled"><AlertTitle>Środowisko {availability.apiEnvironment} — tylko TEST/UAT</AlertTitle>Operacje tworzą prawdziwe konta Firebase oraz zapisy dostępu i transakcji w bazie tego środowiska (backoffice: {environment.name}). Nie używaj danych prawdziwych klientów.</Alert>}
    {availability.state === 'disabled' && <Alert severity="info">Narzędzia testowe są wyłączone w tym środowisku. Włącza je konfiguracja serwera <code>TestTools:Enabled</code> poza produkcją.</Alert>}
    {availability.state === 'error' && <Alert action={<Button color="inherit" onClick={availability.retry}>Spróbuj ponownie</Button>} severity="error">{apiErrorMessage(availability.error, 'Nie udało się sprawdzić dostępności narzędzi testowych.')}</Alert>}
    {availability.state === 'enabled' && <Stack spacing={3}>
      <CreateTestUserCard onCreated={setUser} />
      <ToolCard description="Wybrany użytkownik jest używany przez narzędzia poniżej. Nowo utworzone konto zostaje wybrane automatycznie." title="Użytkownik testowy">
        <UserPicker onChange={setUser} value={user} />
      </ToolCard>
      <SimulatePurchaseCard key={`purchase-${user?.userId ?? 'none'}`} user={user} />
      <SimulateSubscriptionCard key={`subscription-${user?.userId ?? 'none'}`} user={user} />
      <ClearAccessCard key={`clear-${user?.userId ?? 'none'}`} user={user} />
    </Stack>}
  </Box>
}
