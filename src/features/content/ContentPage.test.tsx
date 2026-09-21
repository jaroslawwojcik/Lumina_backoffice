import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { ContentPage } from './ContentPage'
import { fetchResources } from './resourceApi'

vi.mock('./resourceApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./resourceApi')>()), fetchResources: vi.fn() }))
const mockedFetchResources = vi.mocked(fetchResources)
const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions: ['content.read'], staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }

function renderPage(initialEntry = '/content') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/content" element={<ContentPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('ContentPage', () => {
  it('shows resources and only exposes creation to users with content.create', async () => {
    mockedFetchResources.mockResolvedValue({ items: [{ resourceId: 'resource-1', canonicalKey: 'poranna-joga', title: 'Poranna joga', resourceType: 'session', status: 'published', accessTier: 'premium', defaultLocale: 'pl-PL', currentRevisionNumber: 2, updatedAt: '2026-09-10T08:30:00Z' }], nextCursor: null })
    renderPage()
    expect(await screen.findByText('Poranna joga')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nowa sesja' })).not.toBeInTheDocument()
  })

  it('reveals additional filters on demand', async () => {
    mockedFetchResources.mockResolvedValue({ items: [], nextCursor: null })
    renderPage()
    expect(screen.queryByLabelText('Sortowanie')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Więcej filtrów' }))
    expect(screen.getByLabelText('Sortowanie')).toBeInTheDocument()
    expect(screen.getByLabelText('Na stronie')).toBeInTheDocument()
    await screen.findByText('Katalog treści jest pusty.')
  })

  it('uses the server cursor returned by the previous page', async () => {
    mockedFetchResources.mockResolvedValueOnce({ items: [{ resourceId: 'resource-1', canonicalKey: 'poranna-joga', title: 'Poranna joga', resourceType: 'session', status: 'published', accessTier: 'premium', defaultLocale: 'pl-PL', currentRevisionNumber: 2, updatedAt: '2026-09-10T08:30:00Z' }], nextCursor: 'next-page' }).mockResolvedValueOnce({ items: [], nextCursor: null })
    renderPage()
    await screen.findByText('Poranna joga')
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }))
    await waitFor(() => expect(mockedFetchResources.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cursor: 'next-page' })))
    expect(mockedFetchResources.mock.calls.at(-1)?.[1]).toBeInstanceOf(AbortSignal)
  })
})

