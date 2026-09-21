import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { fetchResources } from '../../features/content/resourceApi'

export function ResourcePicker({ value, onChange, onBlur, label, error, helperText, programsOnly = false, disabled = false }: {
  value: string; onChange: (value: string) => void; onBlur?: () => void; label: string; error?: boolean; helperText?: string; programsOnly?: boolean; disabled?: boolean
}) {
  const { permissions } = useAuth()
  const query = useQuery({ queryKey: ['resources', 'form-picker', programsOnly], queryFn: ({ signal }) => fetchResources({ pageSize: 100, sort: 'title:asc', ...(programsOnly ? { type: 'program' } : {}) }, signal), enabled: hasAnyPermission(permissions, ['content.read']) && !disabled })
  const options = (query.data?.items ?? []).filter((item) => programsOnly ? item.resourceType === 'program' : item.resourceType !== 'program')
  return <Autocomplete freeSolo disabled={disabled} options={options} value={options.find((item) => item.resourceId === value) ?? value} loading={query.isFetching} loadingText="Ładowanie zasobów…" onBlur={onBlur} getOptionLabel={(option) => typeof option === 'string' ? option : `${option.title} · ${option.canonicalKey}`} isOptionEqualToValue={(option, selected) => (typeof option === 'string' ? option : option.resourceId) === (typeof selected === 'string' ? selected : selected.resourceId)} onChange={(_, option) => onChange(typeof option === 'string' ? option : option?.resourceId ?? '')} onInputChange={(_, input, reason) => { if (reason === 'input') onChange(input); if (reason === 'clear') onChange('') }} renderInput={(params) => <TextField {...params} label={label} required error={error} helperText={helperText ?? (query.isError ? 'Nie udało się pobrać listy. Możesz wkleić identyfikator UUID.' : 'Wybierz z pierwszych 100 zasobów lub wklej identyfikator UUID.')} />} />
}

