import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material'
import { useId, type ReactNode } from 'react'

/** Confirmation for consequential actions without a reason field. Mount only while open. */
export function ConfirmDialog({ children, confirmLabel, errorMessage, onClose, onConfirm, pending, title }: { children: ReactNode; confirmLabel: string; errorMessage?: string; onClose: () => void; onConfirm: () => void; pending: boolean; title: string }) {
  const titleId = useId()
  return <Dialog aria-labelledby={titleId} fullWidth maxWidth="sm" onClose={pending ? undefined : onClose} open>
    <DialogTitle id={titleId}>{title}</DialogTitle>
    <DialogContent><Stack spacing={2}>{children}{errorMessage && <Alert severity="error">{errorMessage}</Alert>}</Stack></DialogContent>
    <DialogActions><Button disabled={pending} onClick={onClose}>Anuluj</Button><Button autoFocus color="error" disabled={pending} onClick={() => { if (!pending) onConfirm() }} variant="contained">{confirmLabel}</Button></DialogActions>
  </Dialog>
}
