import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined'
import { Box, Button, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchAssetPreview, type MediaAsset } from './mediaApi'

export function AssetPreview({ asset }: { asset: MediaAsset }) {
  const [opened, setOpened] = useState(false)
  const preview = useQuery({ queryKey: ['asset-preview', asset.id], queryFn: ({ signal }) => fetchAssetPreview(asset.id, signal), enabled: opened,
    retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false })
  if (asset.kind === 'image' && asset.publicUrl) return <Box component="img" loading="lazy" src={asset.publicUrl} alt={asset.displayName ?? 'Podgląd obrazu'} sx={{ width: 160, height: 90, objectFit: 'contain', borderRadius: 1 }} />
  if (!['video', 'audio'].includes(asset.kind) || asset.providerStatus !== 'ready') return <Typography color="text.secondary" variant="body2">{['video', 'audio'].includes(asset.kind) ? 'Wymaga weryfikacji' : '—'}</Typography>
  return <Stack spacing={1} sx={{ width: asset.kind === 'video' ? 192 : 240 }}>
    {!opened && <Button startIcon={<PlayArrowOutlined />} variant="outlined" sx={{ minHeight: asset.kind === 'video' ? 108 : 48 }} onClick={() => setOpened(true)} aria-label={`Podgląd ${asset.displayName ?? asset.externalId}`}>{asset.kind === 'video' ? 'Podgląd wideo' : 'Odsłuchaj'}</Button>}
    {opened && preview.isPending && <Typography role="status">Ładowanie podglądu…</Typography>}
    {opened && preview.data && (asset.kind === 'video'
      ? <Box component="iframe" title={`Podgląd ${asset.displayName ?? asset.externalId}`} src={`${preview.data.url}&autoplay=false`} allow="fullscreen; picture-in-picture" allowFullScreen sx={{ width: 192, height: 108, border: 0, borderRadius: 1 }} />
      : <Box component="audio" aria-label={`Odsłuch ${asset.displayName ?? asset.externalId}`} controls preload="none" src={preview.data.url} sx={{ width: 240 }} />)}
    {opened && preview.isError && <Typography color="error" variant="body2">{preview.error.message}</Typography>}
    {opened && <Stack direction="row"><Button size="small" onClick={() => void preview.refetch()}>Odśwież podgląd</Button><Button size="small" onClick={() => setOpened(false)}>Zamknij</Button></Stack>}
  </Stack>
}
