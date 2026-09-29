import { useState } from 'react'
import { Alert, Autocomplete, Button, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchResources, type Resource } from '../content/resourceApi'
import type { Proposal } from './assistantApi'

export function ProgramSections({ proposal, disabled, onSave }: { proposal: Proposal; disabled: boolean; onSave: (proposal: Proposal) => void }) {
  const [sections, setSections] = useState(proposal.sections)
  const [dirty, setDirty] = useState(false)
  const resources = useQuery({ queryKey: ['resources', 'assistant-sessions'], queryFn: ({ signal }) => fetchResources({ type: 'session', pageSize: 100, sort: 'title:asc' }, signal) })
  const options = resources.data?.items ?? []
  const update = (index: number, value: Partial<Proposal['sections'][number]>) => { setDirty(true); setSections((current) => current.map((section, position) => position === index ? { ...section, ...value } : section)) }
  return <Stack spacing={2}>
    <Typography component="h3" variant="h6">Sesje w programie</Typography>
    <Typography color="text.secondary">Wybierz istniejące sesje w kolejności realizacji. Nowe sesje utwórz w osobnej rozmowie.</Typography>
    {resources.isError && <Alert severity="error">Nie udało się pobrać sesji. <Button onClick={() => void resources.refetch()}>Ponów</Button></Alert>}
    {sections.map((section, index) => <Stack key={index} spacing={1}>
      <TextField label={`Tytuł sekcji ${index + 1}`} value={section.title} disabled={disabled} onChange={(event) => update(index, { title: event.target.value })} />
      <Autocomplete<Resource, true> multiple disabled={disabled || resources.isPending} options={options} value={section.entries.map((entry) => options.find((resource) => resource.resourceId === entry.resourceId) ?? { resourceId: entry.resourceId, title: 'Wybrana sesja spoza bieżącej listy' } as Resource)} getOptionLabel={(option) => option.title} isOptionEqualToValue={(a, b) => a.resourceId === b.resourceId} onChange={(_, values) => update(index, { entries: values.map((value) => section.entries.find((entry) => entry.resourceId === value.resourceId) ?? { resourceId: value.resourceId, inheritProgramAccess: false, isOptional: false }) })} renderInput={(params) => <TextField {...params} label={`Sesje w sekcji ${index + 1}`} helperText="Lista obejmuje pierwszych 100 sesji; kolejność wyboru określa kolejność w programie." />} />
      <Button disabled={disabled} color="error" onClick={() => { setDirty(true); setSections(sections.filter((_, position) => position !== index)) }}>Usuń sekcję {index + 1}</Button>
    </Stack>)}
    <Button disabled={disabled} onClick={() => { setDirty(true); setSections([...sections, { title: '', description: null, entries: [] }]) }}>Dodaj sekcję</Button>
    {dirty && <><Alert severity="info">Zapisz układ przed kolejną wiadomością lub zatwierdzeniem całego programu.</Alert><Button disabled={disabled || sections.some((section) => !section.title.trim() || !section.entries.length)} onClick={() => onSave({ ...proposal, sections })}>Zapisz układ programu</Button></>}
  </Stack>
}
