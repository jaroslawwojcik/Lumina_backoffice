import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { fieldError, parseObject, snapshotFields } from './snapshot'

export function SnapshotEditor({ value, onChange, label, disabled = false, suggested = {} }: {
  value: string; onChange: (value: string) => void; label: string; disabled?: boolean; suggested?: Record<string, unknown>
}) {
  const object = parseObject(value)
  const update = (next: unknown) => onChange(JSON.stringify(next, null, 2))
  return <Stack spacing={2}>
    {object ? <ObjectFields value={object} onChange={update} disabled={disabled} suggested={suggested} /> : <Alert severity="warning">Popraw JSON, aby ponownie edytować pola formularza.</Alert>}
    <TextField label={label} value={value} onChange={(event) => onChange(event.target.value)} error={!object} helperText={!object ? 'Wprowadź poprawny obiekt JSON.' : 'Pola i JSON są zsynchronizowane. Dodatkowe właściwości są zachowywane.'} fullWidth multiline minRows={5} maxRows={16} disabled={disabled} slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }} />
  </Stack>
}

function ObjectFields({ value, onChange, disabled, suggested = {}, prefix = '' }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; disabled: boolean; suggested?: Record<string, unknown>; prefix?: string }) {
  const keys = [...new Set([...Object.keys(value), ...Object.keys(suggested)])]
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
    {keys.map((key) => <ValueField key={key} fieldKey={key} label={`${prefix}${snapshotFields[key]?.label ?? key}`} value={value[key]} fallback={suggested[key]} disabled={disabled} onChange={(item) => onChange({ ...value, [key]: item })} />)}
  </Box>
}

function ValueField({ fieldKey, label, value, fallback, disabled, onChange }: { fieldKey: string; label: string; value: unknown; fallback?: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const definition = snapshotFields[fieldKey]
  const error = fieldError(fieldKey, value)
  const sample = value ?? fallback
  if (Array.isArray(sample)) return <Paper variant="outlined" sx={{ p: 2, gridColumn: '1 / -1' }}><Stack spacing={2}><Typography variant="subtitle2">{label}</Typography>{error && <Typography color="error" variant="caption">{error}</Typography>}{sample.map((item, index) => <Stack key={index} spacing={1}><ValueField fieldKey="" label={`${label} ${index + 1}`} value={item} disabled={disabled} onChange={(next) => onChange(sample.map((entry, i) => i === index ? next : entry))} /><Button disabled={disabled} color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => onChange(sample.filter((_, i) => i !== index))}>Usuń pozycję {index + 1}</Button></Stack>)}<Button disabled={disabled} sx={{ alignSelf: 'flex-start' }} onClick={() => onChange([...sample, typeof sample[0] === 'object' && sample[0] !== null ? Object.fromEntries(Object.entries(sample[0]).map(([key, item]) => [key, typeof item === 'boolean' ? false : typeof item === 'number' ? 0 : ''])) : typeof sample[0] === 'number' ? 0 : typeof sample[0] === 'boolean' ? false : ''])}>Dodaj pozycję: {label}</Button></Stack></Paper>
  if (sample !== null && typeof sample === 'object') return <Paper variant="outlined" sx={{ p: 2, gridColumn: '1 / -1' }}><Typography variant="subtitle2" sx={{ mb: 2 }}>{label}</Typography><ObjectFields value={sample as Record<string, unknown>} onChange={onChange} disabled={disabled} prefix={`${label} / `} /></Paper>
  if (definition?.type === 'boolean' || typeof sample === 'boolean') return <Box><FormControlLabel control={<Checkbox disabled={disabled} checked={value === true} onChange={(event) => onChange(event.target.checked)} />} label={label} />{error && <Typography color="error" variant="caption">{error}</Typography>}</Box>
  const isNumber = definition?.type === 'number' || typeof sample === 'number'
  return <TextField label={label} value={typeof value === 'string' || typeof value === 'number' ? value : ''} disabled={disabled} error={Boolean(error)} helperText={error ?? (value === undefined ? 'Opcjonalne — nie dodano do JSON.' : undefined)} select={Boolean(definition?.options)} type={isNumber ? 'number' : 'text'} multiline={definition?.type === 'multiline'} minRows={definition?.type === 'multiline' ? 3 : undefined} sx={definition?.type === 'multiline' ? { gridColumn: '1 / -1' } : undefined} slotProps={{ htmlInput: isNumber ? { min: definition?.min ?? 0, step: 1 } : {} }} onChange={(event) => onChange(isNumber ? event.target.value === '' ? definition?.nullable ? null : '' : Number(event.target.value) : definition?.nullable && event.target.value === '' ? null : event.target.value)}>
    {definition?.options && <MenuItem value="">Nie określono</MenuItem>}{definition?.options?.map(([option, text]) => <MenuItem key={option} value={option}>{text}</MenuItem>)}
  </TextField>
}
