import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useRouteError } from 'react-router-dom'
import { isDynamicImportFailure } from './lazyImport'

export function RouteErrorPage() {
  const error = useRouteError()
  const staleChunk = isDynamicImportFailure(error)
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 560, p: { xs: 3, sm: 5 } }}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h4">Nie udało się otworzyć widoku</Typography>
        <Alert severity={staleChunk ? 'info' : 'error'}>
          {staleChunk ? 'Wdrożono nowszą wersję panelu. Odśwież stronę, aby pobrać aktualne pliki.' : 'Wystąpił nieoczekiwany błąd aplikacji. Odśwież stronę i spróbuj ponownie.'}
        </Alert>
        <Button onClick={() => window.location.reload()} startIcon={<RefreshOutlined />} variant="contained">Odśwież panel</Button>
      </Stack>
    </Paper>
  </Box>
}
