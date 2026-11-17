import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined'
import { Alert, Box, Button, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/apiError'
import { apiErrorMessage, type PickedUser } from '../users/userFormat'
import { createTestUser, createTestUserPayloadSchema, isTestToolsUnavailableError, type CreateTestUserPayload } from './testToolsApi'
import { useTestToolsErrorReporter } from './testToolsAvailability'
import { ToolCard } from './ToolCard'

type Values = { email: string; password: string; displayName: string }
const defaults: Values = { email: '', password: '', displayName: '' }

function toPayload(values: Values): CreateTestUserPayload { return { email: values.email.trim(), ...(values.password ? { password: values.password } : {}), ...(values.displayName.trim() ? { displayName: values.displayName.trim() } : {}) } }

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return 'Konto z tym adresem e-mail już istnieje.'
  return apiErrorMessage(error, 'Nie udało się utworzyć użytkownika testowego.')
}

export function CreateTestUserCard({ onCreated }: { onCreated: (user: PickedUser) => void }) {
  const queryClient = useQueryClient()
  const reportToolError = useTestToolsErrorReporter()
  const form = useForm<Values>({ defaultValues: defaults, mode: 'onTouched' })
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  // gcTime 0: the one-time password must not linger in the mutation cache after this card unmounts.
  const mutation = useMutation({
    mutationFn: (payload: CreateTestUserPayload) => createTestUser(payload),
    retry: false,
    gcTime: 0,
    onSuccess: async (user) => {
      form.reset(defaults)
      setCopyState('idle')
      onCreated({ userId: user.userId, email: user.email, displayName: null })
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: reportToolError,
  })
  const created = mutation.data
  const copy = async (password: string) => {
    try { await navigator.clipboard.writeText(password); setCopyState('copied') } catch { setCopyState('failed') }
  }
  const errors = form.formState.errors
  return <ToolCard description="Tworzy konto Firebase (e-mail i hasło) oraz profil użytkownika w API. Bez nadanego dostępu." title="Utwórz użytkownika testowego">
    {created ? <Stack spacing={2}>
      <Alert severity="success">Utworzono konto {created.email}. <Link to={`/users/${created.userId}`}>Otwórz profil użytkownika</Link></Alert>
      <Alert severity="warning">Hasło jest wyświetlane tylko raz. Skopiuj je teraz — później nie będzie można go odczytać.</Alert>
      <TextField label="Hasło (jednorazowy podgląd)" slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace' }, endAdornment: <InputAdornment position="end"><Tooltip title="Kopiuj hasło"><IconButton aria-label="Kopiuj hasło" edge="end" onClick={() => void copy(created.password)}><ContentCopyOutlined /></IconButton></Tooltip></InputAdornment> } }} value={created.password} />
      {copyState === 'copied' && <Typography aria-live="polite" color="success.main" variant="body2">Skopiowano hasło do schowka.</Typography>}
      {copyState === 'failed' && <Typography aria-live="polite" color="error" variant="body2">Nie udało się skopiować. Zaznacz hasło i skopiuj je ręcznie.</Typography>}
      <Typography color="text.secondary" variant="body2">Firebase UID: {created.firebaseUid} · ID użytkownika: {created.userId}</Typography>
      <Box><Button onClick={() => { setCopyState('idle'); mutation.reset() }} variant="outlined">Ukryj hasło i utwórz kolejne konto</Button></Box>
    </Stack> : <Box component="form" noValidate onSubmit={form.handleSubmit((values) => { if (!mutation.isPending) mutation.mutate(toPayload(values)) })}>
      <Stack spacing={2}>
        <TextField autoComplete="off" disabled={mutation.isPending} error={Boolean(errors.email)} helperText={errors.email?.message ?? 'Użyj adresu testowego, np. qa+zakup1@twoja-domena.pl.'} label="E-mail" required type="email" {...form.register('email', { validate: (value) => createTestUserPayloadSchema.shape.email.safeParse(value).success || 'Podaj poprawny adres e-mail.' })} />
        <TextField autoComplete="new-password" disabled={mutation.isPending} error={Boolean(errors.password)} helperText={errors.password?.message ?? 'Opcjonalnie. Puste pole — serwer wygeneruje hasło.'} label="Hasło (opcjonalnie)" type="password" {...form.register('password', { validate: (value) => !value || value.length >= 6 || 'Hasło musi mieć co najmniej 6 znaków.' })} />
        <TextField autoComplete="off" disabled={mutation.isPending} label="Nazwa wyświetlana (opcjonalnie)" {...form.register('displayName')} />
        {mutation.isError && !isTestToolsUnavailableError(mutation.error) && <Alert severity="error">{errorText(mutation.error)}</Alert>}
        <Box><Button disabled={mutation.isPending} startIcon={<PersonAddOutlined />} type="submit" variant="contained">{mutation.isPending ? 'Tworzenie...' : 'Utwórz użytkownika'}</Button></Box>
      </Stack>
    </Box>}
  </ToolCard>
}
