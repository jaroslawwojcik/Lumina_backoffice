import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/apiError'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { ProductDetailPage } from './ProductsPages'
import { createProductPrice, fetchProduct } from './productApi'

vi.mock('./productApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./productApi')>()), createProductPrice: vi.fn(), fetchProduct: vi.fn() }))

const mockedCreateProductPrice = vi.mocked(createProductPrice)
const mockedFetchProduct = vi.mocked(fetchProduct)
const productId = 'c0a80101-0000-7000-8000-000000000301'
const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions: ['commerce.read', 'commerce.manage'], staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[`/commerce/products/${productId}`]}><Routes><Route path="/commerce/products/:productId" element={<ProductDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('ProductDetailPage', () => {
  it('sends 49,90 as 4990 grosze and shows the API overlap error', async () => {
    mockedFetchProduct.mockResolvedValue({ productId, targetResourceId: 'c0a80101-0000-7000-8000-000000000003', title: 'Tydzień spokoju', description: null, appleProductId: null, googleProductId: null, isActive: true, createdAt: '2026-09-01T08:30:00Z', updatedAt: '2026-09-10T08:30:00Z', prices: [] })
    mockedCreateProductPrice.mockRejectedValue(new ApiError('The price window overlaps an existing price of the same type.', 409))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Dodaj cenę' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Kwota (PLN)' }), { target: { value: '49,90' } })
    fireEvent.change(screen.getByLabelText(/Obowiązuje od/), { target: { value: '2026-10-01T09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj cenę' }))
    await waitFor(() => expect(mockedCreateProductPrice).toHaveBeenCalledWith(productId, { priceType: 'standard', amountInGrosze: 4990, validFrom: '2026-10-01T09:00:00Z' }))
    expect(await screen.findByText('The price window overlaps an existing price of the same type.')).toBeInTheDocument()
  })
})
