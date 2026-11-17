import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchUsers } from './userApi'
import { pickedUserLabel, type PickedUser } from './userFormat'

/** Searches users through the admin list endpoint (min. 2 characters, debounced). */
export function UserPicker({ value, onChange, disabled = false, label = 'Użytkownik' }: { value: PickedUser | null; onChange: (user: PickedUser | null) => void; disabled?: boolean; label?: string }) {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => setSearch(input.trim()), 300); return () => window.clearTimeout(timer) }, [input])
  const enabled = search.length >= 2 && !disabled
  const query = useQuery({ queryKey: ['users', { search, pageSize: 25 }], queryFn: ({ signal }) => fetchUsers({ search, pageSize: 25 }, signal), enabled })
  const options: PickedUser[] = (query.data?.items ?? []).map(({ userId, email, displayName }) => ({ userId, email, displayName }))
  const helperText = query.isError ? 'Nie udało się wyszukać użytkowników.' : input.trim().length === 1 ? 'Wpisz co najmniej 2 znaki.' : 'Szukaj po e-mailu lub nazwie.'
  return <Autocomplete
    disabled={disabled}
    filterOptions={(items) => items}
    getOptionLabel={pickedUserLabel}
    inputValue={input}
    isOptionEqualToValue={(option, selected) => option.userId === selected.userId}
    loading={enabled && query.isFetching}
    loadingText="Wyszukiwanie..."
    noOptionsText={search.length >= 2 ? 'Brak użytkowników.' : 'Wpisz co najmniej 2 znaki.'}
    onChange={(_, user) => onChange(user)}
    onInputChange={(_, next) => setInput(next)}
    options={value && !options.some((option) => option.userId === value.userId) ? [value, ...options] : options}
    renderInput={(params) => <TextField {...params} error={query.isError} helperText={helperText} label={label} />}
    renderOption={({ key, ...props }, option) => <li {...props} key={key}><span>{pickedUserLabel(option)}<br /><small>{option.userId}</small></span></li>}
    value={value}
  />
}
