import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import type { Permission } from '../../auth/permissions'
import { ProductDetailPage, ProductsPage } from './ProductsPages'
import { createProduct, fetchProduct, fetchProducts, updateProduct, type AdminProduct } from './productApi'

vi.mock('./productApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./productApi')>()), createProduct: vi.fn(), fetchProduct: vi.fn(), fetchProducts: vi.fn(), updateProduct: vi.fn() }))

const productId = 'c0a80101-0000-7000-8000-000000000301'
const subscription: AdminProduct = { productId, kind: 'subscription', targetResourceId: null, entitlementKey: 'premium', accessDurationDays: null, title: 'Premium miesięcznie', description: null, appleProductId: 'premium_monthly', googleProductId: 'premium:monthly', isActive: true, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z', prices: [] }

function renderAt(entry: string, permissions: Permission[] = ['commerce.read', 'commerce.manage']) {
  const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[entry]}><Routes><Route path="/commerce/products" element={<ProductsPage />} /><Route path="/commerce/products/:productId" element={<ProductDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

async function chooseKind(dialog: HTMLElement, label: string) { fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Rodzaj produktu' })); fireEvent.click(await screen.findByRole('option', { name: label })) }

beforeEach(() => { vi.clearAllMocks() })

describe('product kinds', () => {
  it('lists the product kind and tolerates products without a target program', async () => {
    vi.mocked(fetchProducts).mockResolvedValue({ items: [{ productId, kind: 'access_pass', targetResourceId: null, title: 'Premium 30 dni', isActive: true, updatedAt: '2026-10-01T08:00:00Z' }], nextCursor: null })
    renderAt('/commerce/products')
    const row = (await screen.findByRole('link', { name: 'Premium 30 dni' })).closest('tr')!
    expect(within(row).getByText('Karnet dostępu')).toBeInTheDocument()
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('creates an access pass with a validated duration and no store identifiers', async () => {
    vi.mocked(fetchProducts).mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(createProduct).mockResolvedValue({ ...subscription, kind: 'access_pass', accessDurationDays: 30 })
    renderAt('/commerce/products')
    fireEvent.click(await screen.findByRole('button', { name: 'Nowy produkt' }))
    const dialog = await screen.findByRole('dialog')
    await chooseKind(dialog, 'Karnet dostępu')
    expect(within(dialog).queryByLabelText(/Apple product ID/)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox', { name: 'Program' })).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Tytuł/), { target: { value: 'Premium 30 dni' } })
    fireEvent.change(within(dialog).getByLabelText(/Długość dostępu/), { target: { value: '400' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Utwórz produkt' }))
    expect(await within(dialog).findByText('Podaj liczbę dni od 1 do 366.')).toBeInTheDocument()
    expect(createProduct).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText(/Długość dostępu/), { target: { value: '30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Utwórz produkt' }))
    await waitFor(() => expect(createProduct).toHaveBeenCalledWith({ kind: 'access_pass', entitlementKey: 'premium', accessDurationDays: 30, title: 'Premium 30 dni' }))
  })

  it('requires the Google subscriptionId:basePlanId format for subscriptions', async () => {
    vi.mocked(fetchProducts).mockResolvedValue({ items: [], nextCursor: null })
    renderAt('/commerce/products')
    fireEvent.click(await screen.findByRole('button', { name: 'Nowy produkt' }))
    const dialog = await screen.findByRole('dialog')
    await chooseKind(dialog, 'Subskrypcja')
    expect(within(dialog).getByText(/subscriptionId:basePlanId — dokładnie tak/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Tytuł/), { target: { value: 'Premium' } })
    fireEvent.change(within(dialog).getByLabelText(/Google product ID/), { target: { value: 'premium_monthly' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Utwórz produkt' }))
    expect(await within(dialog).findByText('Użyj formatu subscriptionId:basePlanId.')).toBeInTheDocument()
    expect(createProduct).not.toHaveBeenCalled()
  })

  it('keeps the kind locked when editing and sends the stored kind fields', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(subscription)
    vi.mocked(updateProduct).mockResolvedValue(subscription)
    renderAt(`/commerce/products/${productId}`)
    expect(await screen.findByRole('heading', { name: 'Premium miesięcznie' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rodzaj produktu' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Cena subskrypcji jest ustalana w App Store i Google Play/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz produkt' }))
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith(productId, { kind: 'subscription', entitlementKey: 'premium', title: 'Premium miesięcznie', appleProductId: 'premium_monthly', googleProductId: 'premium:monthly', isActive: true }))
    expect(await screen.findByText('Zapisano produkt.')).toBeInTheDocument()
  })
})
