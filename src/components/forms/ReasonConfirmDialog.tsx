import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { useId, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { reasonMaxLength, validateReason } from './reasonValidation'

/**
 * Confirmation for consequential actions that require an audited reason.
 * Mount it only while open so each opening starts with an empty reason.
 */
export function ReasonConfirmDialog({ children, confirmLabel, errorMessage, onClose, onConfirm, pending, title }: { children: ReactNode; confirmLabel: string; errorMessage?: string; onClose: () => void; onConfirm: (reason: string) => void; pending: boolean; title: string }) {
  const titleId = useId()
  const form = useForm<{ reason: string }>({ defaultValues: { reason: '' }, mode: 'onTouched' })
  const reason = useWatch({ control: form.control, name: 'reason' })
  const error = form.formState.errors.reason?.message
  const close = () => { if (pending) return; if (form.formState.isDirty && !window.confirm('Odrzucić wpisany powód?')) return; onClose() }
  return <Dialog aria-labelledby={titleId} fullWidth maxWidth="sm" onClose={close} open>
    <Box component="form" noValidate onSubmit={form.handleSubmit((values) => { if (!pending) onConfirm(values.reason.trim()) })}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {children}
        <TextField autoFocus disabled={pending} error={Boolean(error)} helperText={error ?? `${reason.trim().length}/${reasonMaxLength} znaków. Powód trafi do dziennika audytu.`} label="Powód" minRows={2} multiline required {...form.register('reason', { validate: validateReason })} />
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={pending} onClick={close}>Anuluj</Button><Button color="error" disabled={pending} type="submit" variant="contained">{confirmLabel}</Button></DialogActions>
    </Box>
  </Dialog>
}
