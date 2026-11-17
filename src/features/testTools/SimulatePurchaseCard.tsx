import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import { Alert, Box, Button, MenuItem, Stack, TextField } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchProducts, productKindLabels, type AdminProductListItem, type ProductKind } from '../commerce/productApi'
import { labelFor, storeLabels } from '../users/monetizationLabels'
import { userQueryKeys } from '../users/userApi'
import { apiErrorMessage, pickedUserLabel, type PickedUser } from '../users/userFormat'
import { isTestToolsUnavailableError, simulateTestPurchase, type SimulatePurchasePayload, type TestStore } from './testToolsApi'
import { useTestToolsErrorReporter } from './testToolsAvailability'
import { ToolCard } from './ToolCard'

const productSearch = { active: true, pageSize: 100 } as const

/** Stores consistent with the sales model: subscriptions only via app stores, access passes only via PayU. */
function storesForKind(kind: ProductKind): readonly TestStore[] {
  if (kind === 'subscription') return ['app_store', 'play_store']
  if (kind === 'access_pass') return ['payu']
  return ['app_store', 'play_store', 'payu']
}

export function SimulatePurchaseCard({ user }: { user: PickedUser | null }) {
  const queryClient = useQueryClient()
  const reportToolError = useTestToolsErrorReporter()
  const products = useQuery({ queryKey: ['products', productSearch], queryFn: ({ signal }) => fetchProducts(productSearch, signal) })
  const [productId, setProductId] = useState('')
  const [store, setStore] = useState<TestStore | ''>('')
  const product: AdminProductListItem | undefined = products.data?.items.find((item) => item.productId === productId)
  const stores = product ? storesForKind(product.kind) : []
  const mutation = useMutation({
    mutationFn: (payload: SimulatePurchasePayload) => simulateTestPurchase(payload),
    retry: false,
    onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(variables.userId) }) },
    onError: reportToolError,
  })
  const canSubmit = Boolean(user && product && store && stores.includes(store)) && !mutation.isPending
  const submit = () => { if (user && product && store && canSubmit) mutation.mutate({ userId: user.userId, productId: product.productId, store }) }
  return <ToolCard description="Wykonuje zakup tymi samymi usługami domenowymi co prawdziwe płatności, z dostawcą „test” i środowiskiem sandbox." title="Symuluj zakup">
    {!user && <Alert severity="info">Najpierw wybierz użytkownika testowego.</Alert>}
    {products.isError && <Alert action={<Button color="inherit" onClick={() => void products.refetch()}>Spróbuj ponownie</Button>} severity="error">{apiErrorMessage(products.error, 'Nie udało się pobrać produktów.')}</Alert>}
    {products.isSuccess && products.data.items.length === 0 && <Alert severity="info">Brak aktywnych produktów.</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField disabled={!user || mutation.isPending || !products.isSuccess} helperText={products.isPending ? 'Ładowanie produktów...' : 'Tylko aktywne produkty (do 100).'} label="Produkt" onChange={(event) => { const next = products.data?.items.find((item) => item.productId === event.target.value); setProductId(event.target.value); const allowed = next ? storesForKind(next.kind) : []; setStore(allowed.length === 1 ? allowed[0] : ''); mutation.reset() }} select sx={{ minWidth: 280, flex: 2 }} value={productId}>
        {(products.data?.items ?? []).map((item) => <MenuItem key={item.productId} value={item.productId}>{item.title} ({productKindLabels[item.kind]})</MenuItem>)}
      </TextField>
      <TextField disabled={!product || mutation.isPending} helperText={product?.kind === 'subscription' ? 'Subskrypcje są sprzedawane tylko w sklepach.' : product?.kind === 'access_pass' ? 'Karnety są sprzedawane tylko przez PayU.' : ' '} label="Sklep" onChange={(event) => setStore(event.target.value as TestStore)} select sx={{ minWidth: 200, flex: 1 }} value={store}>
        {stores.map((value) => <MenuItem key={value} value={value}>{labelFor(storeLabels, value)}</MenuItem>)}
      </TextField>
    </Stack>
    {mutation.isError && !isTestToolsUnavailableError(mutation.error) && <Alert severity="error">{apiErrorMessage(mutation.error, 'Nie udało się zasymulować zakupu. Sprawdź dostęp użytkownika przed ponowną próbą.')}</Alert>}
    {mutation.isSuccess && <Alert role="status" severity="success">Zasymulowano zakup dla {user ? pickedUserLabel(user) : 'użytkownika'}. Transakcja: {mutation.data.transactionId}, uprawnienie: {mutation.data.grantId}{mutation.data.subscriptionId ? `, subskrypcja: ${mutation.data.subscriptionId}` : ''}.</Alert>}
    <Box><Button disabled={!canSubmit} onClick={submit} startIcon={<ShoppingCartOutlined />} variant="contained">{mutation.isPending ? 'Symulowanie...' : 'Symuluj zakup'}</Button></Box>
  </ToolCard>
}
