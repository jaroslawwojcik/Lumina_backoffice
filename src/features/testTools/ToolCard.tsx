import { Paper, Stack, Typography } from '@mui/material'
import { useId, type ReactNode } from 'react'

export function ToolCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const headingId = useId()
  return <Paper aria-labelledby={headingId} component="section" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 2, sm: 3 } }}>
    <Stack spacing={2}>
      <div><Typography component="h2" id={headingId} variant="h5">{title}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>{description}</Typography></div>
      {children}
    </Stack>
  </Paper>
}
