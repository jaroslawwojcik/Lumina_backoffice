import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../../api/apiError'
import { ReasonConfirmDialog } from '../../components/forms/ReasonConfirmDialog'
import { labelFor, orderStatusLabels, providerLabels } from './monetizationLabels'
import { canRefundOrder, isRefundRepeat, refundErrorMessage, refundSuccessMessage } from './orderRefund'
import { fetchUserOrders, formatGroszeAsPln, refundOrder, userQueryKeys, type AdminUserOrder } from './userApi'
import { formatDate } from './userFormat'
import { PagedTab } from './UserTabPanels'

function orderAmount(order: AdminUserOrder): string { return order.currency === 'PLN' ? formatGroszeAsPln(order.amountInGrosze) : order.currency }

/** Orders are PayU checkout orders; `completed` ones can be refunded and `refund_pending` ones can repeat the refund (full refund only). */
export function UserOrdersTab({ userId, canRefund }: { userId: string; canRefund: boolean }) {
  const queryClient = useQueryClient()
  const [refunding, setRefunding] = useState<AdminUserOrder>()
  const [feedback, setFeedback] = useState<string>()
  const invalidateOrderViews = () => Promise.all([userQueryKeys.orders(userId), userQueryKeys.access(userId), userQueryKeys.transactions(userId)].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  const mutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => refundOrder(orderId, reason),
    retry: false,
    onSuccess: async (order) => {
      setRefunding(undefined)
      setFeedback(refundSuccessMessage(order))
      await invalidateOrderViews()
    },
    // 404/409/503 mean the order state is stale or changed on the server (503 leaves it refund_pending), so refresh it.
    onError: async (error) => { if (error instanceof ApiError && (error.status === 404 || error.status === 409 || error.status === 503)) await invalidateOrderViews() },
  })

  return <Stack spacing={2}>
    {feedback && <Alert onClose={() => setFeedback(undefined)} role="status" severity="success">{feedback}</Alert>}
    <PagedTab empty="Brak zamówień do wyświetlenia." failure="Nie udało się pobrać zamówień użytkownika." fetchPage={(search, signal) => fetchUserOrders(userId, search, signal)} queryKey={userQueryKeys.orders(userId)} render={(items) => <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><Table aria-label="Zamówienia użytkownika"><TableHead><TableRow><TableCell>Produkt</TableCell><TableCell>Kwota</TableCell><TableCell>Status</TableCell><TableCell>Utworzono</TableCell>{canRefund && <TableCell align="right">Działania</TableCell>}</TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.orderId}>
      <TableCell>{item.productTitle}<Typography color="text.secondary" variant="body2">{labelFor(providerLabels, item.provider)}</Typography></TableCell>
      <TableCell>{orderAmount(item)}</TableCell>
      <TableCell>{labelFor(orderStatusLabels, item.status)}{item.failureCode && <Typography color="text.secondary" variant="body2">Kod błędu: {item.failureCode}</Typography>}</TableCell>
      <TableCell>{formatDate(item.createdAt)}</TableCell>
      {canRefund && <TableCell align="right">{canRefundOrder(item) && <Button aria-label={`${isRefundRepeat(item) ? 'Ponów zwrot' : 'Zwrot'} zamówienia ${item.productTitle}`} color="error" disabled={mutation.isPending} onClick={() => { mutation.reset(); setFeedback(undefined); setRefunding(item) }}>{isRefundRepeat(item) ? 'Ponów zwrot' : 'Zwrot'}</Button>}</TableCell>}
    </TableRow>)}</TableBody></Table></TableContainer>} />
    {refunding && <ReasonConfirmDialog confirmLabel={isRefundRepeat(refunding) ? 'Ponów zwrot' : 'Zleć zwrot'} errorMessage={mutation.isError ? refundErrorMessage(mutation.error) : undefined} onClose={() => setRefunding(undefined)} onConfirm={(reason) => mutation.mutate({ orderId: refunding.orderId, reason })} pending={mutation.isPending} title={isRefundRepeat(refunding) ? 'Ponowić zwrot?' : 'Zlecić zwrot?'}>
      <Typography>Zlecisz w PayU pełny zwrot <strong>{orderAmount(refunding)}</strong> za „{refunding.productTitle}”. Zwrotów częściowych nie obsługujemy.</Typography>
      {isRefundRepeat(refunding) && <Alert severity="info">Zwrot został już zlecony, ale PayU mogło go nie otrzymać. Ponowienie jest bezpieczne — nie spowoduje podwójnego zwrotu.</Alert>}
      <Alert severity="warning">Po potwierdzeniu zwrotu przez PayU dostęp nadany tym zamówieniem zostanie odebrany. Operacji nie można cofnąć.</Alert>
    </ReasonConfirmDialog>}
  </Stack>
}
