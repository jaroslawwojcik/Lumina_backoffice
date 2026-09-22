import { Paper, Typography } from '@mui/material'

export function JsonPreview({ value, label = 'Podgląd JSON' }: { value: unknown; label?: string }) {
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: 'var(--color-paper-2)', minWidth: 0 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
    <Typography component="pre" aria-label={label} sx={{ m: 0, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 360, overflow: 'auto' }}>{JSON.stringify(value, null, 2)}</Typography>
  </Paper>
}
