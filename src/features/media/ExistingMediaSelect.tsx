import { Alert, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchAssets, type MediaAsset } from './mediaApi'

type SelectableKind = 'video' | 'audio' | 'image'

type Props = {
  kind: SelectableKind
  label: string
  value?: string
  disabled?: boolean
  onChange: (asset?: MediaAsset) => void
}

function canSelect(asset: MediaAsset, kind: SelectableKind): boolean {
  if (asset.kind !== kind || asset.providerStatus !== 'ready') return false
  if (kind === 'image') return Boolean(asset.publicUrl)
  return Boolean(asset.durationSeconds && asset.durationSeconds > 0)
}

function assetLabel(asset: MediaAsset): string {
  const name = asset.displayName ?? asset.originalFileName ?? asset.externalId ?? asset.id
  if (asset.kind === 'image' && asset.width && asset.height) return `${name} · ${asset.width}×${asset.height}`
  if ((asset.kind === 'video' || asset.kind === 'audio') && asset.durationSeconds) return `${name} · ${asset.durationSeconds} s`
  return name
}

export function ExistingMediaSelect({ kind, label, value = '', disabled = false, onChange }: Props) {
  const assetsQuery = useQuery({
    queryKey: ['assets', 'create-resource-picker', kind],
    queryFn: ({ signal }) => fetchAssets({ kind, pageSize: 100 }, signal),
    retry: false,
  })
  const assets = (assetsQuery.data?.items ?? []).filter((asset) => canSelect(asset, kind))

  return <Stack spacing={1}>
    <FormControl disabled={disabled || assetsQuery.isPending} fullWidth>
      <InputLabel id={`existing-${kind}-label`}>{label}</InputLabel>
      <Select
        label={label}
        labelId={`existing-${kind}-label`}
        value={assets.some((asset) => asset.id === value) ? value : ''}
        onChange={(event) => onChange(assets.find((asset) => asset.id === event.target.value))}
      >
        <MenuItem value="">Nie wybrano</MenuItem>
        {assets.map((asset) => <MenuItem key={asset.id} value={asset.id}>{assetLabel(asset)}</MenuItem>)}
      </Select>
      <FormHelperText>{assetsQuery.isPending ? 'Ładowanie biblioteki…' : assets.length === 0 ? 'Brak gotowych mediów tego typu.' : 'Możesz wybrać gotowe medium albo przesłać nowe poniżej.'}</FormHelperText>
    </FormControl>
    {assetsQuery.isError && <Alert severity="error">Nie udało się pobrać biblioteki mediów.</Alert>}
    {value && !assets.some((asset) => asset.id === value) && <Typography color="text.secondary" variant="body2">Wybrano właśnie przesłane medium.</Typography>}
  </Stack>
}
