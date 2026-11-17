import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import type { CursorPage, UserListSearch } from './userApi'

function isEmptyList(data: unknown): boolean { return Array.isArray(data) ? data.length === 0 : Array.isArray((data as { items?: unknown[] }).items) && (data as { items: unknown[] }).items.length === 0 }

export function QueryPanel<T>({ query, empty, failure, render }: { query: UseQueryResult<T>; empty: string; failure: string; render: (data: T) => ReactNode }) {
  if (query.isPending) return <Typography aria-live="polite">Ładowanie...</Typography>
  if (query.isError) return <Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">{failure}</Alert>
  return <>{query.isRefetchError && <Alert severity="warning" sx={{ mb: 2 }}>Nie udało się odświeżyć danych. Wyświetlane dane mogą być nieaktualne.</Alert>}{isEmptyList(query.data) ? <Alert severity="info">{empty}</Alert> : render(query.data)}</>
}

export function CursorPagination<T>({ page, onNext, onPrevious, previousEnabled }: { page: CursorPage<T>; onNext: () => void; onPrevious: () => void; previousEnabled: boolean }) { return <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}><Button disabled={!previousEnabled} onClick={onPrevious}>Poprzednia</Button><Button disabled={!page.nextCursor} onClick={onNext} variant="outlined">Następna</Button></Stack> }

export function PagedTab<T>({ queryKey, fetchPage, empty, failure, render }: { queryKey: readonly string[]; fetchPage: (search: UserListSearch, signal?: AbortSignal) => Promise<CursorPage<T>>; empty: string; failure: string; render: (items: T[]) => ReactNode }) {
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<string[]>([])
  const query = useQuery({ queryKey: [...queryKey, cursor], queryFn: ({ signal }) => fetchPage({ pageSize: 25, ...(cursor ? { cursor } : {}) }, signal) })
  return <QueryPanel query={query} empty={empty} failure={failure} render={(page) => <>{render(page.items)}<CursorPagination page={page} onNext={() => { if (page.nextCursor) { setPrevious((items) => [...items, cursor ?? '']); setCursor(page.nextCursor) } }} onPrevious={() => { const next = previous.at(-1); setPrevious((items) => items.slice(0, -1)); setCursor(next || undefined) }} previousEnabled={previous.length > 0} /></>} />
}
