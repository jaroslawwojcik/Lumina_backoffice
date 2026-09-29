import { Box, Chip, Stack, Typography } from '@mui/material'
import type { AssistantDraft } from './assistantApi'

const levels: Record<string, string> = { beginner: 'Początkujący', intermediate: 'Średniozaawansowany', advanced: 'Zaawansowany', expert: 'Ekspercki' }
export function DraftPreview({ draft }: { draft: AssistantDraft }) {
  const proposal = draft.proposal
  return <Stack spacing={2}>
    <Typography variant="overline">Propozycja do zatwierdzenia · {draft.kind === 'session' ? 'sesja' : 'program'}</Typography>
    <Typography component="h2" variant="h5">{proposal.title || 'Tytuł powstanie w rozmowie'}</Typography>
    {proposal.summary && <Typography>{proposal.summary}</Typography>}
    {proposal.description && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{proposal.description}</Typography>}
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
      {draft.kind === 'session' && proposal.mediaKind && <Chip label={proposal.mediaKind === 'video' ? 'Wideo' : 'Audio'} size="small" />}
      {draft.kind === 'session' && proposal.durationSeconds && <Chip label={`${proposal.durationSeconds} s`} size="small" />}
      {proposal.level && <Chip label={levels[proposal.level] ?? proposal.level} size="small" />}
      {proposal.estimatedDays && <Chip label={`${proposal.estimatedDays} dni`} size="small" />}
    </Stack>
    {proposal.publicMetadata.instructorDisplayName && <Typography>Prowadzący: {proposal.publicMetadata.instructorDisplayName}</Typography>}
    {proposal.publicMetadata.style && <Typography>Styl: {proposal.publicMetadata.style}</Typography>}
    {([['Cele', proposal.publicMetadata.intents], ['Obszary', proposal.publicMetadata.focusAreas], ['Sprzęt', proposal.publicMetadata.equipment]] as const).filter(([, values]) => values.length).map(([label, values]) => <Typography key={label}>{label}: {values.join(', ')}</Typography>)}
    {proposal.sections.map((section, index) => <Box key={index}><Typography sx={{ fontWeight: 600 }}>{index + 1}. {section.title}</Typography><Typography>{section.description}</Typography><Typography color="text.secondary">Wybrane sesje: {section.entries.length}</Typography></Box>)}
    {proposal.slug && <Typography color="text.secondary" variant="body2">Adres: {proposal.slug}</Typography>}
  </Stack>
}
