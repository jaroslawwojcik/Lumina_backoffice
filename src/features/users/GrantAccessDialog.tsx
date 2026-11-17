import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ResourcePicker } from '../../components/forms/ResourcePicker'
import { reasonMaxLength, validateReason } from '../../components/forms/reasonValidation'
import { utcInputToIso } from '../commerce/productApi'
import { uuidPattern } from '../commerce/productForm'
import { grantUserAccess, userQueryKeys, type AdminUserAccessGrant, type GrantAccessPayload } from './userApi'
import { accessMutationErrorMessage } from './userFormat'

type GrantFormValues = { scope: 'entitlement' | 'resource'; entitlementKey: 'premium'; resourceId: string; validUntil: string; reason: string }
const defaults: GrantFormValues = { scope: 'entitlement', entitlementKey: 'premium', resourceId: '', validUntil: '', reason: '' }

function toPayload(values: GrantFormValues): GrantAccessPayload {
  const validUntil = values.validUntil ? utcInputToIso(values.validUntil) : undefined
  const common = { reason: values.reason.trim(), ...(validUntil ? { validUntil } : {}) }
  return values.scope === 'entitlement' ? { scope: 'entitlement', entitlementKey: values.entitlementKey, ...common } : { scope: 'resource', resourceId: values.resourceId.trim(), ...common }
}

function validateValidUntil(value: string): true | string {
  if (!value) return true
  const iso = utcInputToIso(value)
  if (!iso) return 'Podaj datę i godzinę UTC.'
  return new Date(iso).getTime() > Date.now() || 'Data końca musi przypadać w przyszłości.'
}

/** Support grant (source `support`). Mount only while open so the form starts clean. */
export function GrantAccessDialog({ userId, onClose, onGranted }: { userId: string; onClose: () => void; onGranted: (grant: AdminUserAccessGrant) => void }) {
  const titleId = useId()
  const queryClient = useQueryClient()
  const form = useForm<GrantFormValues>({ defaultValues: defaults, mode: 'onTouched' })
  const scope = useWatch({ control: form.control, name: 'scope' })
  const reason = useWatch({ control: form.control, name: 'reason' })
  const mutation = useMutation({
    mutationFn: (values: GrantFormValues) => grantUserAccess(userId, toPayload(values)),
    retry: false,
    onSuccess: async (grant) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: userQueryKeys.access(userId) }), queryClient.invalidateQueries({ queryKey: userQueryKeys.transactions(userId) })])
      onGranted(grant)
    },
  })
  const close = () => { if (mutation.isPending) return; if (form.formState.isDirty && !window.confirm('Odrzucić niezapisane dane?')) return; onClose() }
  const errors = form.formState.errors
  return <Dialog aria-labelledby={titleId} fullWidth maxWidth="sm" onClose={close} open>
    <Box component="form" noValidate onSubmit={form.handleSubmit((values) => { if (!mutation.isPending) mutation.mutate(values) })}>
      <DialogTitle id={titleId}>Nadaj dostęp</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">Dostęp zostanie nadany ze źródłem „Wsparcie” i zapisany w dzienniku audytu.</Alert>
        <Controller control={form.control} name="scope" render={({ field }) => <TextField {...field} autoFocus disabled={mutation.isPending} label="Zakres" required select><MenuItem value="entitlement">Uprawnienie (Premium)</MenuItem><MenuItem value="resource">Zasób (program)</MenuItem></TextField>} />
        {scope === 'entitlement'
          ? <Controller control={form.control} name="entitlementKey" render={({ field }) => <TextField {...field} disabled={mutation.isPending} label="Uprawnienie" required select><MenuItem value="premium">premium</MenuItem></TextField>} />
          : <Controller control={form.control} name="resourceId" rules={{ validate: (value) => form.getValues('scope') !== 'resource' || uuidPattern.test(value.trim()) || 'Wybierz program lub podaj poprawny identyfikator UUID.' }} render={({ field, fieldState }) => <ResourcePicker disabled={mutation.isPending} error={Boolean(fieldState.error)} helperText={fieldState.error?.message} label="Program" onBlur={field.onBlur} onChange={field.onChange} programsOnly value={field.value} />} />}
        <TextField disabled={mutation.isPending} error={Boolean(errors.validUntil)} helperText={errors.validUntil?.message ?? 'Opcjonalnie. Czas UTC. Puste pole oznacza dostęp bezterminowy.'} label="Ważny do (UTC)" slotProps={{ inputLabel: { shrink: true } }} type="datetime-local" {...form.register('validUntil', { validate: validateValidUntil })} />
        <TextField disabled={mutation.isPending} error={Boolean(errors.reason)} helperText={errors.reason?.message ?? `${reason.trim().length}/${reasonMaxLength} znaków, minimum 5.`} label="Powód" minRows={2} multiline required {...form.register('reason', { validate: validateReason })} />
        {mutation.isError && <Alert severity="error">{accessMutationErrorMessage(mutation.error, 'Nie udało się nadać dostępu. Stan zapisu jest nieznany — odśwież listę przed ponowną próbą.')}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={close}>Anuluj</Button><Button disabled={mutation.isPending} startIcon={<SaveOutlined />} type="submit" variant="contained">{mutation.isPending ? 'Nadawanie...' : 'Nadaj dostęp'}</Button></DialogActions>
    </Box>
  </Dialog>
}
