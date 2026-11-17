import { Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { commerceEnvironmentLabels, labelFor, providerLabels, storeLabels, transactionTypeLabels } from './monetizationLabels'
import { fetchUserTransactions, formatGroszeAsPln, userQueryKeys, type AdminUserTransaction } from './userApi'
import { formatDate } from './userFormat'
import { PagedTab } from './UserTabPanels'

function amount(item: AdminUserTransaction): string {
  if (item.amountInGrosze === null) return '—'
  return item.currency === 'PLN' ? formatGroszeAsPln(item.amountInGrosze) : `${item.amountInGrosze} (${item.currency ?? 'waluta nieznana'}, grosze)`
}

export function UserTransactionsTab({ userId }: { userId: string }) {
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5">Transakcje</Typography>
    <Typography color="text.secondary">Księga zdarzeń płatności i dostępu. Wpisy są tylko dopisywane i nie podlegają edycji.</Typography>
    <PagedTab empty="Brak transakcji do wyświetlenia." failure="Nie udało się pobrać transakcji użytkownika." fetchPage={(search, signal) => fetchUserTransactions(userId, search, signal)} queryKey={userQueryKeys.transactions(userId)} render={(items) => <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><Table aria-label="Transakcje użytkownika"><TableHead><TableRow><TableCell>Data zdarzenia</TableCell><TableCell>Typ</TableCell><TableCell>Produkt</TableCell><TableCell>Kwota</TableCell><TableCell>Źródło</TableCell><TableCell>Identyfikatory</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.transactionId}>
      <TableCell>{formatDate(item.occurredAt)}</TableCell>
      <TableCell>{labelFor(transactionTypeLabels, item.type)}</TableCell>
      <TableCell>{item.productTitle ?? item.storeProductId ?? '—'}</TableCell>
      <TableCell>{amount(item)}</TableCell>
      <TableCell><Stack spacing={.5} sx={{ alignItems: 'flex-start' }}><span>{labelFor(providerLabels, item.provider)} · {labelFor(storeLabels, item.store)}</span>{item.environment !== 'production' && <Chip color="warning" label={labelFor(commerceEnvironmentLabels, item.environment)} size="small" variant="outlined" />}</Stack></TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere' }}><Typography variant="body2">{item.storeTransactionId ?? item.transactionId}</Typography>{item.originalTransactionId && item.originalTransactionId !== item.storeTransactionId && <Typography color="text.secondary" variant="body2">Oryginalna: {item.originalTransactionId}</Typography>}</TableCell>
    </TableRow>)}</TableBody></Table></TableContainer>} />
  </Stack>
}
