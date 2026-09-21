import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { MediaLibraryPage } from './MediaLibraryPage'
import { fetchAssets, registerAsset } from './mediaApi'

vi.mock('./mediaApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./mediaApi')>()), fetchAssets: vi.fn(), registerAsset: vi.fn() }))

const mockedFetchAssets = vi.mocked(fetchAssets)
const mockedRegisterAsset = vi.mocked(registerAsset)
const asset = { id: 'c0a80101-0000-7000-8000-000000000201', kind: 'audio' as const, provider: 'bunny-stream', externalId: 'library-audio-001', storageKey: null, publicUrl: null, mimeType: 'audio/mpeg', bytes: 4858291, width: null, height: null, durationSeconds: 600, createdAt: '2026-09-10T08:30:00Z' }

function renderPage(permissions: AuthState['permissions']) {
  const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter><MediaLibraryPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('MediaLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchAssets.mockResolvedValue({ items: [asset], nextCursor: null })
  })

  it('shows safe asset metadata and hides registration without media.upload', async () => {
    renderPage(['media.read'])
    expect(await screen.findByText('library-audio-001')).toBeInTheDocument()
    expect(screen.getByText('bunny-stream')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zarejestruj zasób' })).not.toBeInTheDocument()
    expect(screen.queryByText('publicUrl')).not.toBeInTheDocument()
    expect(screen.queryByText('storageKey')).not.toBeInTheDocument()
  })

  it('shows numeric validation beside the field and does not submit invalid metadata', async () => {
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Zarejestruj zasób' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Dostawca' }), { target: { value: 'bunny-stream' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Identyfikator u dostawcy' }), { target: { value: 'asset' } })
    fireEvent.change(screen.getByLabelText('Szerokość (opcjonalnie)'), { target: { value: '-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }))
    await waitFor(() => expect(screen.getByLabelText('Szerokość (opcjonalnie)')).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('Podaj liczbę całkowitą nie mniejszą niż 1.')).toBeInTheDocument()
    expect(mockedRegisterAsset).not.toHaveBeenCalled()
  })

  it('submits an existing provider asset without URL or storage-key inputs', async () => {
    mockedRegisterAsset.mockResolvedValue(asset)
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Zarejestruj zasób' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Dostawca' }), { target: { value: 'bunny-stream' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Identyfikator u dostawcy' }), { target: { value: 'existing-asset' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }))
    await waitFor(() => expect(mockedRegisterAsset.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ provider: 'bunny-stream', externalId: 'existing-asset' })))
    expect(screen.queryByLabelText(/URL|klucz/i)).not.toBeInTheDocument()
  })
})


