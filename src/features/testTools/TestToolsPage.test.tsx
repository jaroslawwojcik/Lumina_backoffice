import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/apiError'
import { AuthContext, type AuthState } from '../../auth/authContext'
import type { Permission } from '../../auth/permissions'
import { AppShell } from '../../layouts/AppShell'
import { fetchProducts } from '../commerce/productApi'
import { fetchUserSubscriptions, fetchUsers } from '../users/userApi'
import { clearTestAccess, createTestUser, fetchTestToolsStatus, simulateSubscriptionEvent, simulateTestPurchase } from './testToolsApi'
import { TestToolsPage } from './TestToolsPage'

vi.mock('./testToolsApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./testToolsApi')>()), fetchTestToolsStatus: vi.fn(), createTestUser: vi.fn(), simulateTestPurchase: vi.fn(), simulateSubscriptionEvent: vi.fn(), clearTestAccess: vi.fn() }))
vi.mock('../commerce/productApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../commerce/productApi')>()), fetchProducts: vi.fn() }))
vi.mock('../users/userApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../users/userApi')>()), fetchUsers: vi.fn(), fetchUserSubscriptions: vi.fn() }))

const userId = 'c0a80101-0000-7000-8000-000000000401'
const subscriptionId = 'c0a80101-0000-7000-8000-000000000701'
const products = [
  { productId: 'c0a80101-0000-7000-8000-000000000301', kind: 'subscription' as const, targetResourceId: null, title: 'Premium miesięcznie', isActive: true, updatedAt: '2026-10-01T08:00:00Z' },
  { productId: 'c0a80101-0000-7000-8000-000000000302', kind: 'access_pass' as const, targetResourceId: null, title: 'Premium 30 dni', isActive: true, updatedAt: '2026-10-01T08:00:00Z' },
]
const testSubscription = { subscriptionId, provider: 'test', store: 'app_store', environment: 'sandbox', productId: products[0].productId, productTitle: 'Premium miesięcznie', storeProductId: 'premium_monthly', originalTransactionId: 'test-1', entitlementKey: 'premium', status: 'active', willRenew: true, currentPeriodStart: '2026-10-01T08:00:00Z', currentPeriodEnd: '2026-10-31T08:00:00Z', gracePeriodEnd: null, cancelledAt: null, billingIssueDetectedAt: null, refundedAt: null, lastSyncedAt: '2026-10-01T08:00:00Z', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z' }
const disabledProblem = () => new ApiError('Test tools are disabled.', 404, undefined, 'test-tools-disabled')

function authState(permissions: Permission[]): AuthState { return { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() } }
function newQueryClient() { return new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
/** Renders the page and waits for the status probe, so the tools are mounted when the test starts. */
async function renderPage(client = newQueryClient()) {
  render(<QueryClientProvider client={client}><AuthContext.Provider value={authState(['testtools.use', 'users.read', 'access.read', 'commerce.read'])}><MemoryRouter initialEntries={['/test-tools']}><Routes><Route path="/test-tools" element={<TestToolsPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
  await screen.findByText(/tylko TEST\/UAT/)
  return client
}

async function createUser() {
  vi.mocked(createTestUser).mockResolvedValue({ userId, firebaseUid: 'firebase-uid-1', email: 'qa@example.test', password: 'Generated#Pass1' })
  fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'qa@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }))
  await screen.findByDisplayValue('Generated#Pass1')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchTestToolsStatus).mockResolvedValue({ enabled: true, environment: 'Staging' })
  vi.mocked(fetchProducts).mockResolvedValue({ items: products, nextCursor: null })
  vi.mocked(fetchUsers).mockResolvedValue({ items: [], nextCursor: null })
})

describe('TestToolsPage', () => {
  it('shows the TEST/UAT warning banner with the environment reported by the API', async () => {
    await renderPage()
    expect(screen.getByText(/Środowisko Staging — tylko TEST\/UAT/)).toBeInTheDocument()
    expect(fetchTestToolsStatus).toHaveBeenCalledTimes(1)
  })

  it('shows a disabled state when the status probe answers 404 test-tools-disabled', async () => {
    vi.mocked(fetchTestToolsStatus).mockRejectedValue(disabledProblem())
    render(<QueryClientProvider client={newQueryClient()}><AuthContext.Provider value={authState(['testtools.use'])}><MemoryRouter><TestToolsPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
    expect(await screen.findByText(/Narzędzia testowe są wyłączone w tym środowisku/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utwórz użytkownika' })).not.toBeInTheDocument()
  })

  it('shows a retryable error when the status probe fails for another reason, including a plain not-found 404', async () => {
    vi.mocked(fetchTestToolsStatus).mockRejectedValueOnce(new ApiError('Nie znaleziono.', 404, undefined, 'not-found'))
    render(<QueryClientProvider client={newQueryClient()}><AuthContext.Provider value={authState(['testtools.use'])}><MemoryRouter><TestToolsPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
    expect(await screen.findByText('Nie znaleziono.')).toBeInTheDocument()
    expect(screen.queryByText(/są wyłączone/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))
    expect(await screen.findByText(/tylko TEST\/UAT/)).toBeInTheDocument()
  })

  it('shows a generated password once with a copy button and selects the new user', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
        await renderPage()
    await createUser()
    expect(createTestUser).toHaveBeenCalledWith({ email: 'qa@example.test' })
    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj hasło' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Generated#Pass1'))
    expect(await screen.findByText('Skopiowano hasło do schowka.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Użytkownik' })).toHaveValue('qa@example.test')
    fireEvent.click(screen.getByRole('button', { name: 'Ukryj hasło i utwórz kolejne konto' }))
    expect(screen.queryByDisplayValue('Generated#Pass1')).not.toBeInTheDocument()
  })

  it('maps a duplicate e-mail conflict to a Polish message', async () => {
    vi.mocked(createTestUser).mockRejectedValue(new ApiError('Email exists', 409))
        await renderPage()
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'qa@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }))
    expect(await screen.findByText('Konto z tym adresem e-mail już istnieje.')).toBeInTheDocument()
  })

  it('re-checks the status when a tool answers test-tools-disabled, but keeps other 404s as normal errors', async () => {
    vi.mocked(createTestUser).mockRejectedValueOnce(new ApiError('User was not found.', 404, undefined, 'not-found'))
    await renderPage()
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'qa@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }))
    expect(await screen.findByText('User was not found.')).toBeInTheDocument()
    expect(fetchTestToolsStatus).toHaveBeenCalledTimes(1)
    vi.mocked(createTestUser).mockRejectedValueOnce(disabledProblem())
    vi.mocked(fetchTestToolsStatus).mockRejectedValue(disabledProblem())
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz użytkownika' }))
    expect(await screen.findByText(/Narzędzia testowe są wyłączone w tym środowisku/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utwórz użytkownika' })).not.toBeInTheDocument()
  })

  it('limits stores by product kind and simulates a purchase for the selected user', async () => {
    vi.mocked(fetchUserSubscriptions).mockResolvedValue([])
    vi.mocked(simulateTestPurchase).mockResolvedValue({ transactionId: 'c0a80101-0000-7000-8000-000000000601', grantId: 'c0a80101-0000-7000-8000-000000000501', subscriptionId: null })
        await renderPage()
    await createUser()
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Produkt' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Premium 30 dni (Karnet dostępu)' }))
    expect(screen.getByRole('combobox', { name: 'Sklep' })).toHaveTextContent('PayU')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Produkt' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Premium miesięcznie (Subskrypcja)' }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sklep' }))
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['App Store', 'Google Play'])
    fireEvent.click(screen.getByRole('option', { name: 'Google Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Symuluj zakup' }))
    await waitFor(() => expect(simulateTestPurchase).toHaveBeenCalledWith({ userId, productId: products[0].productId, store: 'play_store' }))
    expect(await screen.findByText(/Zasymulowano zakup dla qa@example.test/)).toBeInTheDocument()
  })

  it('confirms a subscription event before simulating it', async () => {
    vi.mocked(fetchUserSubscriptions).mockResolvedValue([testSubscription, { ...testSubscription, subscriptionId: 'c0a80101-0000-7000-8000-000000000702', provider: 'revenuecat', productTitle: 'Prawdziwa' }])
    vi.mocked(simulateSubscriptionEvent).mockResolvedValue({ ...testSubscription, status: 'expired' })
        await renderPage()
    await createUser()
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Subskrypcja testowa' }))
    expect(screen.queryByRole('option', { name: /Prawdziwa/ })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('option', { name: /Premium miesięcznie — Aktywna/ }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Zdarzenie' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Wygaśnięcie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Symuluj zdarzenie' }))
    const dialog = await screen.findByRole('dialog', { name: 'Zastosować zdarzenie?' })
    expect(simulateSubscriptionEvent).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zastosuj zdarzenie' }))
    await waitFor(() => expect(simulateSubscriptionEvent).toHaveBeenCalledWith(subscriptionId, 'expire'))
    expect(await screen.findByText(/Nowy status: Wygasła/)).toBeInTheDocument()
  })

  it('clears test access only after confirmation', async () => {
    vi.mocked(fetchUserSubscriptions).mockResolvedValue([])
    vi.mocked(clearTestAccess).mockResolvedValue()
        await renderPage()
    await createUser()
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść dostęp' }))
    const dialog = await screen.findByRole('dialog', { name: 'Wyczyścić dostęp?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wyczyść dostęp' }))
    await waitFor(() => expect(clearTestAccess).toHaveBeenCalledWith(userId))
    expect(await screen.findByText('Wyczyszczono dostęp testowy i wsparcia.')).toBeInTheDocument()
  })
})

describe('test tools navigation', () => {
  function renderShell(permissions: Permission[]) {
    return render(<QueryClientProvider client={newQueryClient()}><AuthContext.Provider value={authState(permissions)}><MemoryRouter initialEntries={['/']}><Routes><Route element={<AppShell />} path="/" /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
  }

  it('shows the entry only with testtools.use and does not probe the API without it', () => {
    renderShell(['users.read'])
    expect(screen.queryByRole('link', { name: 'Narzędzia testowe' })).not.toBeInTheDocument()
    expect(fetchTestToolsStatus).not.toHaveBeenCalled()
  })

  it('shows the entry when the status probe reports enabled', async () => {
    renderShell(['testtools.use'])
    expect(await screen.findByRole('link', { name: 'Narzędzia testowe' })).toHaveAttribute('href', '/test-tools')
  })

  it('hides the entry when the API reports test tools as disabled', async () => {
    vi.mocked(fetchTestToolsStatus).mockRejectedValue(disabledProblem())
    renderShell(['testtools.use'])
    await waitFor(() => expect(fetchTestToolsStatus).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('link', { name: 'Narzędzia testowe' })).not.toBeInTheDocument()
  })
})
