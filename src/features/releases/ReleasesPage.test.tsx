import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { ReleasesPage } from './ReleasesPage'
import { fetchReleaseDetail, fetchReleases } from './releaseApi'

vi.mock('./releaseApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./releaseApi')>()), fetchReleaseDetail: vi.fn(), fetchReleases: vi.fn() }))

const mockedFetchReleaseDetail = vi.mocked(fetchReleaseDetail)
const mockedFetchReleases = vi.mocked(fetchReleases)
const release = { id: 'c0a80101-0000-7000-8000-000000000101', locale: 'pl-PL', status: 'active', createdAt: '2026-09-12T09:30:00Z', publishedAt: '2026-09-12T10:10:00Z', activatedAt: '2026-09-12T10:15:00Z', itemCount: 24, catalogStorageKey: 'content/pl-PL/releases/release-1/catalog.json', catalogEtag: 'etag-1', isActive: true }
const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions: ['content.read'], staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }

function renderPage(initialEntry = '/releases') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/releases" element={<ReleasesPage />} /><Route path="/releases/:releaseId" element={<ReleasesPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('ReleasesPage', () => {
  it('shows release fields from the server and keeps creation permission-gated', async () => {
    mockedFetchReleases.mockResolvedValue({ items: [release], nextCursor: null })
    renderPage()
    expect(await screen.findByText('etag-1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: release.id })).toHaveAttribute('href', `/releases/${release.id}`)
    expect(screen.queryByRole('link', { name: 'Nowe wydanie' })).not.toBeInTheDocument()
  })

  it('uses the server cursor for the next release page', async () => {
    mockedFetchReleases.mockResolvedValueOnce({ items: [release], nextCursor: 'next-page' }).mockResolvedValueOnce({ items: [], nextCursor: null })
    renderPage()
    await screen.findByText('etag-1')
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }))
    await waitFor(() => expect(mockedFetchReleases.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cursor: 'next-page' })))
  })

  it('returns to the preceding cursor page', async () => {
    mockedFetchReleases.mockResolvedValueOnce({ items: [release], nextCursor: 'next-page' }).mockResolvedValueOnce({ items: [release], nextCursor: null }).mockResolvedValueOnce({ items: [release], nextCursor: 'next-page' })
    renderPage()
    await screen.findByText('etag-1')
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }))
    await waitFor(() => expect(mockedFetchReleases.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cursor: 'next-page' })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Wstecz' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }))
    await waitFor(() => expect(mockedFetchReleases.mock.calls.at(-1)?.[0]).toEqual(expect.not.objectContaining({ cursor: expect.anything() })))
  })

  it('loads release detail at its routed URL', async () => {
    mockedFetchReleaseDetail.mockResolvedValue(release)
    renderPage(`/releases/${release.id}`)
    expect(await screen.findByText('Klucz katalogu: content/pl-PL/releases/release-1/catalog.json')).toBeInTheDocument()
  })
})
