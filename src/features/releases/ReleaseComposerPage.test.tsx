import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { fetchResourceDetail, fetchResources } from '../content/resourceApi'
import { ReleaseComposerPage } from './ReleaseComposerPage'
import { activateRelease, buildRelease } from './releaseApi'

vi.mock('../content/resourceApi', () => ({ fetchResources: vi.fn(), fetchResourceDetail: vi.fn() }))
vi.mock('./releaseApi', () => ({ buildRelease: vi.fn(), activateRelease: vi.fn() }))

const mockedFetchResources = vi.mocked(fetchResources)
const mockedFetchResourceDetail = vi.mocked(fetchResourceDetail)
const mockedBuildRelease = vi.mocked(buildRelease)
const mockedActivateRelease = vi.mocked(activateRelease)

function renderPage(permissions: AuthState['permissions'] = ['release.build', 'release.activate']) {
  const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter><ReleaseComposerPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('ReleaseComposerPage', () => {
  it('builds from the detail-confirmed current revision and activates only after an explicit action', async () => {
    mockedFetchResources.mockResolvedValue({ items: [{ resourceId: 'resource-1', canonicalKey: 'poranna-joga', title: 'Poranna joga', resourceType: 'session', status: 'published', accessTier: 'premium', defaultLocale: 'pl', currentRevisionNumber: 2, updatedAt: '2026-09-10T08:30:00Z' }], nextCursor: null })
    mockedFetchResourceDetail.mockResolvedValue({ resourceId: 'resource-1', canonicalKey: 'poranna-joga', resourceType: 'session', status: 'published', accessTier: 'premium', defaultLocale: 'pl', version: 2, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-10T08:00:00Z', translation: { locale: 'pl', slug: 'poranna-joga', title: 'Poranna joga', summary: null, description: null, seoTitle: null, seoDescription: null }, session: { mediaKind: 'video', durationSeconds: 1200, featured: false, intensity: null }, material: null, currentRevision: { revisionId: 'revision-2', revisionNumber: 2, note: null, createdAt: '2026-09-10T08:00:00Z', snapshot: {} } })
    mockedBuildRelease.mockResolvedValue({ releaseId: 'release-1', locale: 'pl', catalogEtag: 'etag-1', catalogStorageKey: 'content/pl-PL/releases/release-1/catalog.json' })
    mockedActivateRelease.mockResolvedValue({ releaseId: 'release-1', locale: 'pl', publishedAt: '2026-09-13T12:00:00Z' })

    renderPage()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Wybierz Poranna joga' }))
    await waitFor(() => expect(mockedFetchResourceDetail).toHaveBeenCalledWith('resource-1', 'pl', expect.any(AbortSignal)))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Utwórz wydanie' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz wydanie' }))
    await waitFor(() => expect(mockedBuildRelease).toHaveBeenCalledWith({ locale: 'pl', revisions: [{ resourceId: 'resource-1', revisionId: 'revision-2' }] }))
    expect(await screen.findByText('release-1')).toBeInTheDocument()
    expect(mockedActivateRelease).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Aktywuj wydanie' }))
    await waitFor(() => expect(mockedActivateRelease).toHaveBeenCalledWith('release-1'))
    expect(await screen.findByText(/Wydanie aktywowano/)).toBeInTheDocument()
  })

  it('does not offer activation to a user without release.activate', async () => {
    mockedFetchResources.mockResolvedValue({ items: [], nextCursor: null })
    renderPage(['release.build'])
    expect(await screen.findByText('Brak treści z tłumaczeniem dla wybranego języka.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aktywuj wydanie' })).not.toBeInTheDocument()
  })
})

