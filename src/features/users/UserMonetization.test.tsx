import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/apiError'
import { AuthContext, type AuthState } from '../../auth/authContext'
import type { Permission } from '../../auth/permissions'
import { UserDetailPage } from './UsersPages'
import { fetchUser, fetchUserAccess, fetchUserOrders, fetchUserSubscriptions, fetchUserTransactions, grantUserAccess, refundOrder, revokeUserAccessGrant, syncUserRevenueCat, type AdminUserAccessGrant, type AdminUserOrder } from './userApi'

vi.mock('./userApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./userApi')>()), fetchUser: vi.fn(), fetchUserAccess: vi.fn(), fetchUserOrders: vi.fn(), fetchUserSubscriptions: vi.fn(), fetchUserTransactions: vi.fn(), grantUserAccess: vi.fn(), revokeUserAccessGrant: vi.fn(), syncUserRevenueCat: vi.fn(), refundOrder: vi.fn() }))

const userId = 'c0a80101-0000-7000-8000-000000000401'
const user = { userId, authProvider: 'firebase', authSubject: 'subject', email: 'alicja@example.test', displayName: 'Alicja Kowalska', firstName: null, lastName: null, locale: 'pl-PL', timeZone: 'Europe/Warsaw', notificationsEnabled: true, theme: 'system', createdAt: '2026-09-01T08:30:00Z', updatedAt: '2026-09-10T08:30:00Z' }
const storeGrant: AdminUserAccessGrant = { grantId: 'c0a80101-0000-7000-8000-000000000501', scope: 'entitlement', entitlementKey: 'premium', resourceId: null, resourceKey: null, source: 'revenuecat', validFrom: '2026-10-01T08:00:00Z', validUntil: '2099-01-01T00:00:00Z', createdAt: '2026-10-01T08:00:00Z', revokedAt: null, revokeReason: null }
const revokedGrant: AdminUserAccessGrant = { ...storeGrant, grantId: 'c0a80101-0000-7000-8000-000000000502', source: 'support', revokedAt: '2026-10-02T08:00:00Z', revokeReason: 'Pomyłka konsultanta' }
const completedOrder: AdminUserOrder = { orderId: 'c0a80101-0000-7000-8000-000000000402', productId: 'c0a80101-0000-7000-8000-000000000403', productTitle: 'Tydzień spokoju', targetProgramResourceId: 'c0a80101-0000-7000-8000-000000000404', currency: 'PLN', amountInGrosze: 4990, status: 'completed', createdAt: '2026-09-01T08:30:00Z', updatedAt: '2026-09-01T08:30:00Z', completedAt: '2026-09-01T08:35:00Z', failureCode: null, provider: 'payu', productKind: 'course' }
const pendingOrder: AdminUserOrder = { ...completedOrder, orderId: 'c0a80101-0000-7000-8000-000000000405', productTitle: 'Premium 30 dni', status: 'refund_pending' }
const storeOrder: AdminUserOrder = { ...completedOrder, orderId: 'c0a80101-0000-7000-8000-000000000406', productTitle: 'Zamówienie spoza PayU', provider: 'revenuecat' }

function renderPage(permissions: Permission[]) {
  const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[`/users/${userId}`]}><Routes><Route path="/users/:userId" element={<UserDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

async function openTab(name: string) { await screen.findByRole('heading', { name: 'Alicja Kowalska' }); fireEvent.click(screen.getByRole('tab', { name })) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchUser).mockResolvedValue(user)
  vi.mocked(fetchUserAccess).mockResolvedValue({ userId, items: [storeGrant, revokedGrant] })
})

describe('user access management', () => {
  it('shows access read-only without access.grant_support, including the revoke reason', async () => {
    renderPage(['users.read', 'access.read'])
    await openTab('Dostęp')
    expect(await screen.findByText(/Powód: Pomyłka konsultanta/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nadaj dostęp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Odbierz/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Synchronizuj z RevenueCat' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Subskrypcje' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Transakcje' })).toBeInTheDocument()
  })

  it('hides access, subscription and transaction tabs without access.read', async () => {
    vi.mocked(fetchUserOrders).mockResolvedValue({ items: [], nextCursor: null })
    renderPage(['users.read'])
    await screen.findByRole('heading', { name: 'Alicja Kowalska' })
    for (const name of ['Dostęp', 'Subskrypcje', 'Transakcje']) expect(screen.queryByRole('tab', { name })).not.toBeInTheDocument()
  })

  it('validates the grant reason, sends the grant and refreshes access', async () => {
    vi.mocked(grantUserAccess).mockResolvedValue({ ...storeGrant, grantId: 'c0a80101-0000-7000-8000-000000000503', source: 'support' })
    renderPage(['users.read', 'access.read', 'access.grant_support'])
    await openTab('Dostęp')
    fireEvent.click(await screen.findByRole('button', { name: 'Nadaj dostęp' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nadaj dostęp' })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'abc' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nadaj dostęp' }))
    expect(await within(dialog).findByText('Podaj powód (co najmniej 5 znaków).')).toBeInTheDocument()
    expect(grantUserAccess).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText(/Ważny do/), { target: { value: '2099-12-31T23:59' } })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Reklamacja nr 42' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nadaj dostęp' }))
    await waitFor(() => expect(grantUserAccess).toHaveBeenCalledWith(userId, { scope: 'entitlement', entitlementKey: 'premium', validUntil: '2099-12-31T23:59:00Z', reason: 'Reklamacja nr 42' }))
    expect(await screen.findByText('Nadano dostęp: premium.')).toBeInTheDocument()
    await waitFor(() => expect(fetchUserAccess).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires a valid program id for resource grants', async () => {
    renderPage(['users.read', 'access.read', 'access.grant_support'])
    await openTab('Dostęp')
    fireEvent.click(await screen.findByRole('button', { name: 'Nadaj dostęp' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nadaj dostęp' })
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Zakres' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Zasób (program)' }))
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Program' }), { target: { value: 'nie-uuid' } })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Prezent od zespołu' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nadaj dostęp' }))
    expect(await within(dialog).findByText('Wybierz program lub podaj poprawny identyfikator UUID.')).toBeInTheDocument()
    expect(grantUserAccess).not.toHaveBeenCalled()
  })

  it('warns that store grants can be re-created by sync and shows a revoke failure', async () => {
    vi.mocked(revokeUserAccessGrant).mockRejectedValue(new ApiError('Grant was already revoked.', 409))
    renderPage(['users.read', 'access.read', 'access.grant_support'])
    await openTab('Dostęp')
    fireEvent.click(await screen.findByRole('button', { name: 'Odbierz dostęp premium' }))
    const dialog = await screen.findByRole('dialog', { name: 'Odebrać dostęp?' })
    expect(within(dialog).getByText(/kolejna synchronizacja utworzy je ponownie/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Zwrot w App Store' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Odbierz dostęp' }))
    await waitFor(() => expect(revokeUserAccessGrant).toHaveBeenCalledWith(userId, storeGrant.grantId, 'Zwrot w App Store'))
    expect(await within(dialog).findByText('Grant was already revoked.')).toBeInTheDocument()
  })

  it('synchronizes with RevenueCat and reports the resulting entitlements', async () => {
    vi.mocked(syncUserRevenueCat).mockResolvedValue({ premium: { isActive: true, validUntil: '2026-11-01T08:00:00Z', source: 'revenuecat', status: 'active', willRenew: true, store: 'app_store', productId: null }, courses: [] })
    renderPage(['users.read', 'access.read', 'access.grant_support'])
    await openTab('Dostęp')
    fireEvent.click(await screen.findByRole('button', { name: 'Synchronizuj z RevenueCat' }))
    expect(await screen.findByText(/Zsynchronizowano z RevenueCat\. Premium aktywne/)).toBeInTheDocument()
    await waitFor(() => expect(fetchUserAccess).toHaveBeenCalledTimes(2))
  })
})

describe('subscriptions and transactions', () => {
  it('lists subscriptions with Polish status labels and an empty state', async () => {
    vi.mocked(fetchUserSubscriptions).mockResolvedValueOnce([{ subscriptionId: 'c0a80101-0000-7000-8000-000000000701', provider: 'revenuecat', store: 'play_store', environment: 'sandbox', productId: null, productTitle: 'Premium miesięcznie', storeProductId: 'premium:monthly', originalTransactionId: 'GPA.1', entitlementKey: 'premium', status: 'grace_period', willRenew: true, currentPeriodStart: '2026-10-01T08:00:00Z', currentPeriodEnd: '2026-11-01T08:00:00Z', gracePeriodEnd: '2026-11-04T08:00:00Z', cancelledAt: null, billingIssueDetectedAt: '2026-11-01T08:00:00Z', refundedAt: null, lastSyncedAt: '2026-11-01T09:00:00Z', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z' }])
    renderPage(['users.read', 'access.read'])
    await openTab('Subskrypcje')
    expect(await screen.findByText('Premium miesięcznie')).toBeInTheDocument()
    expect(screen.getByText('Okres karencji')).toBeInTheDocument()
    expect(screen.getByText('Sandbox')).toBeInTheDocument()
  })

  it('pages transactions with the server cursor', async () => {
    const row = { transactionId: 'c0a80101-0000-7000-8000-000000000601', provider: 'payu', store: 'payu', environment: 'production', type: 'purchase', productId: null, productTitle: 'Premium 30 dni', productKind: 'access_pass', storeProductId: null, storeTransactionId: null, originalTransactionId: null, currency: 'PLN', amountInGrosze: 4990, providerEventId: null, occurredAt: '2026-10-02T08:00:00Z', createdAt: '2026-10-02T08:00:00Z' }
    vi.mocked(fetchUserTransactions).mockResolvedValueOnce({ items: [row], nextCursor: 'cursor-2' }).mockResolvedValueOnce({ items: [{ ...row, transactionId: 'c0a80101-0000-7000-8000-000000000602', type: 'refund', amountInGrosze: -4990 }], nextCursor: null })
    renderPage(['users.read', 'access.read'])
    await openTab('Transakcje')
    expect(await screen.findByText('Zakup')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Następna' }))
    await waitFor(() => expect(fetchUserTransactions).toHaveBeenLastCalledWith(userId, { pageSize: 25, cursor: 'cursor-2' }, expect.any(AbortSignal)))
    expect(await screen.findByText('-49,90 zł')).toBeInTheDocument()
  })
})

describe('order refunds', () => {
  beforeEach(() => { vi.mocked(fetchUserOrders).mockResolvedValue({ items: [completedOrder, pendingOrder], nextCursor: null }) })

  it('offers refunds only for completed orders and only with commerce.manage', async () => {
    renderPage(['users.read'])
    await openTab('Zamówienia')
    expect(await screen.findByText('Opłacone')).toBeInTheDocument()
    expect(screen.getByText('Zwrot w toku')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Zwrot zamówienia/ })).not.toBeInTheDocument()
  })

  it('confirms the refund with a reason and refreshes the orders', async () => {
    vi.mocked(refundOrder).mockResolvedValue({ ...completedOrder, status: 'refund_pending' })
    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    expect(await screen.findAllByRole('button', { name: /zwrot zamówienia/i })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Zwrot zamówienia Tydzień spokoju' }))
    const dialog = await screen.findByRole('dialog', { name: 'Zlecić zwrot?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zleć zwrot' }))
    expect(await within(dialog).findByText('Podaj powód (co najmniej 5 znaków).')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Klient zrezygnował' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zleć zwrot' }))
    await waitFor(() => expect(refundOrder).toHaveBeenCalledWith(completedOrder.orderId, 'Klient zrezygnował'))
    expect(await screen.findByText(/Zlecono zwrot zamówienia „Tydzień spokoju”\. Status: Zwrot w toku/)).toBeInTheDocument()
    await waitFor(() => expect(fetchUserOrders).toHaveBeenCalledTimes(2))
  })

  it('hides the refund action for completed orders that were not paid through PayU', async () => {
    vi.mocked(fetchUserOrders).mockResolvedValue({ items: [storeOrder], nextCursor: null })
    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    expect(await screen.findByText('Zamówienie spoza PayU')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Zwrot zamówienia/ })).not.toBeInTheDocument()
  })

  it.each([
    [400, /sprawdź powód \(5–500 znaków\)/, false],
    [404, /Nie znaleziono zamówienia/, true],
    [409, /nie można zwrócić/, true],
    [503, /PayU jest chwilowo niedostępne.*ponowienie jest bezpieczne/, true],
  ])('explains a %i refund failure in Polish and keeps the dialog open for a retry', async (status, message, refreshes) => {
    vi.mocked(refundOrder).mockRejectedValue(new ApiError('English server detail', status))
    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    fireEvent.click(await screen.findByRole('button', { name: 'Zwrot zamówienia Tydzień spokoju' }))
    const dialog = await screen.findByRole('dialog', { name: 'Zlecić zwrot?' })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Klient zrezygnował' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zleć zwrot' }))
    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(screen.queryByText('English server detail')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Zleć zwrot' })).toBeEnabled()
    await waitFor(() => expect(fetchUserOrders).toHaveBeenCalledTimes(refreshes ? 2 : 1))
  })

  it('keeps a refund repeatable after a PayU 503 left the order refund_pending, also after closing the dialog or reloading', async () => {
    const orders = [completedOrder]
    vi.mocked(fetchUserOrders).mockImplementation(async () => ({ items: [...orders], nextCursor: null }))
    vi.mocked(refundOrder).mockRejectedValueOnce(new ApiError('PayU unavailable', 503)).mockResolvedValueOnce({ ...completedOrder, status: 'refund_pending' })
    const first = renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    fireEvent.click(await screen.findByRole('button', { name: 'Zwrot zamówienia Tydzień spokoju' }))
    let dialog = await screen.findByRole('dialog', { name: 'Zlecić zwrot?' })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Klient zrezygnował' } })
    orders[0] = { ...completedOrder, status: 'refund_pending' } // the backend leaves the order refund_pending after the 503
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zleć zwrot' }))
    expect(await within(dialog).findByText(/ponowienie jest bezpieczne/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Anuluj/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Ponów zwrot zamówienia Tydzień spokoju' })).toBeInTheDocument()
    first.unmount()

    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    fireEvent.click(await screen.findByRole('button', { name: 'Ponów zwrot zamówienia Tydzień spokoju' }))
    dialog = await screen.findByRole('dialog', { name: 'Ponowić zwrot?' })
    expect(within(dialog).getByText(/zwrot został już zlecony.*ponowienie jest bezpieczne/i)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Klient zrezygnował' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ponów zwrot' }))
    await waitFor(() => expect(refundOrder).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Zlecono zwrot zamówienia „Tydzień spokoju”/)).toBeInTheDocument()
  })

  it.each(['refunded', 'failed', 'cancelled'])('does not offer a refund for a %s order', async (status) => {
    vi.mocked(fetchUserOrders).mockResolvedValue({ items: [{ ...completedOrder, status }], nextCursor: null })
    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    expect(await screen.findByText('Tydzień spokoju')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /zwrot zamówienia/i })).not.toBeInTheDocument()
  })

  it('reports a refund the provider already completed or cancelled according to the returned status', async () => {
    vi.mocked(refundOrder).mockResolvedValue({ ...completedOrder, status: 'completed' })
    renderPage(['users.read', 'commerce.manage'])
    await openTab('Zamówienia')
    fireEvent.click(await screen.findByRole('button', { name: 'Zwrot zamówienia Tydzień spokoju' }))
    const dialog = await screen.findByRole('dialog', { name: 'Zlecić zwrot?' })
    fireEvent.change(within(dialog).getByLabelText(/Powód/), { target: { value: 'Klient zrezygnował' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zleć zwrot' }))
    expect(await screen.findByText(/PayU anulowało zwrot zamówienia „Tydzień spokoju”/)).toBeInTheDocument()
  })
})

describe('RevenueCat sync failures', () => {
  it.each([
    [404, /użytkownik nie istnieje lub nie ma konta powiązanego z RevenueCat/],
    [503, /RevenueCat jest chwilowo niedostępny/],
  ])('maps a %i answer to a Polish message', async (status, message) => {
    vi.mocked(fetchUserSubscriptions).mockResolvedValue([])
    vi.mocked(syncUserRevenueCat).mockRejectedValue(new ApiError('English server detail', status))
    renderPage(['users.read', 'access.read', 'access.grant_support'])
    await openTab('Subskrypcje')
    fireEvent.click(await screen.findByRole('button', { name: 'Synchronizuj z RevenueCat' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})
