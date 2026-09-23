import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { MediaLibraryPage } from './MediaLibraryPage'
import { fetchAssetPreview, fetchAssets, registerAsset, updateAsset } from './mediaApi'

vi.mock('./mediaApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./mediaApi')>()), fetchAssets: vi.fn(), registerAsset: vi.fn(), updateAsset: vi.fn(), fetchAssetPreview: vi.fn() }))
vi.mock('./videoUploadApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./videoUploadApi')>()), videoUploadConfiguration: vi.fn().mockResolvedValue({ enabled: true, maximumBytes: 1000000, mimeTypes: ['video/mp4'] }) }))

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

  it('validates the Bunny identifier and keeps provider metadata read-only for video', async () => {
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Zarejestruj zasób' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa w bibliotece' }), { target: { value: 'Film' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Identyfikator filmu w Bunny' }), { target: { value: 'asset' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Identyfikator filmu w Bunny' })).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText('Szerokość (opcjonalnie)')).toBeDisabled()
    expect(mockedRegisterAsset).not.toHaveBeenCalled()
  })

  it('registers a Bunny video with server verification and no guessed metadata', async () => {
    mockedRegisterAsset.mockResolvedValue({ ...asset, kind: 'video', provider: 'bunny_stream', providerStatus: 'ready' })
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Zarejestruj zasób' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa w bibliotece' }), { target: { value: 'Film' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Identyfikator filmu w Bunny' }), { target: { value: asset.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }))
    await waitFor(() => expect(mockedRegisterAsset.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ provider: 'bunny_stream', externalId: asset.id, displayName: 'Film', verifyProvider: true, durationSeconds: null })))
    expect(screen.queryByLabelText(/URL|klucz/i)).not.toBeInTheDocument()
  })

  it('filters on the server and resets pagination when changing media tabs', async () => {
    mockedFetchAssets.mockResolvedValue({ items: [asset], nextCursor: 'next-page' })
    renderPage(['media.read'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dalej' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }))
    await waitFor(() => expect(mockedFetchAssets).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next-page' }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('tab', { name: 'Audio' }))
    await waitFor(() => expect(mockedFetchAssets).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'audio', cursor: undefined }), expect.any(AbortSignal)))
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeDisabled()
  })

  it('edits ready audio names without changing protected metadata or showing video dimensions', async () => {
    const audio = { ...asset, displayName: 'Oddech', provider: 'bunny_storage', providerStatus: 'ready', storageKey: 'audio/test.mp3', externalId: null }
    mockedFetchAssets.mockResolvedValue({ items: [audio], nextCursor: null })
    vi.mocked(updateAsset).mockResolvedValue({ ...audio, displayName: 'Spokojny oddech' })
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj Oddech' }))
    expect(screen.queryByLabelText('Szerokość (opcjonalnie)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Czas trwania w sekundach (opcjonalnie)')).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa w bibliotece' }), { target: { value: 'Spokojny oddech' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))
    await waitFor(() => expect(updateAsset).toHaveBeenCalledWith(asset.id, expect.objectContaining({ displayName: 'Spokojny oddech', storageKey: audio.storageKey, durationSeconds: 600, verifyProvider: false })))
  })

  it('fills the edit form with verified Bunny metadata after repairing a legacy video', async () => {
    const video = { ...asset, kind: 'video' as const, displayName: 'Joga', provider: 'bunny_stream', externalId: asset.id, durationSeconds: null }
    mockedFetchAssets.mockResolvedValue({ items: [video], nextCursor: null })
    vi.mocked(updateAsset).mockResolvedValue({ ...video, durationSeconds: 123, width: 1920, height: 1080, providerStatus: 'ready', providerLibraryId: '123' })
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj Joga' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz i zapisz metadane z Bunny' }))
    await waitFor(() => expect(screen.getByLabelText('Czas trwania w sekundach (opcjonalnie)')).toHaveValue(123))
    expect(screen.getByLabelText('Szerokość (opcjonalnie)')).toHaveValue(1920)
    expect(screen.getByText(/Metadane pobrano z Bunny/)).toBeInTheDocument()
  })

  it('lets an administrator complete missing Bunny metadata manually', async () => {
    const video = { ...asset, kind: 'video' as const, displayName: 'Joga', provider: 'bunny_stream', externalId: asset.id, durationSeconds: null, width: null, height: null, providerStatus: 'unverified' as const, metadataSource: null }
    mockedFetchAssets.mockResolvedValue({ items: [video], nextCursor: null })
    vi.mocked(updateAsset).mockResolvedValue({ ...video, durationSeconds: 120, width: 1920, height: 1080, bytes: 123456, providerStatus: 'ready', metadataSource: 'manual' })
    renderPage(['media.read', 'media.upload'])

    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj Joga' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Uzupełnij metadane filmu ręcznie' }))
    fireEvent.change(screen.getByLabelText('Czas trwania w sekundach (opcjonalnie)'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('Szerokość (opcjonalnie)'), { target: { value: '1920' } })
    fireEvent.change(screen.getByLabelText('Wysokość (opcjonalnie)'), { target: { value: '1080' } })
    fireEvent.change(screen.getByLabelText('Rozmiar w bajtach (opcjonalnie)'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    await waitFor(() => expect(updateAsset).toHaveBeenCalledWith(asset.id, expect.objectContaining({
      verifyProvider: false,
      useManualMetadata: true,
      durationSeconds: 120,
      width: 1920,
      height: 1080,
      bytes: 123456,
    })))
  })

  it('opens video upload directly in registration', async () => {
    renderPage(['media.read', 'media.upload'])
    fireEvent.click(await screen.findByRole('button', { name: 'Zarejestruj zasób' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Prześlij plik' }))
    expect(await screen.findByText('Wideo do biblioteki')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Wybierz plik')).not.toHaveClass('Mui-disabled'))
    expect(screen.getByLabelText('Plik głównego wideo')).toHaveAttribute('type', 'file')
  })

  it('plays audio in the preview column using short-lived authorization', async () => {
    mockedFetchAssets.mockResolvedValue({ items: [{ ...asset, displayName: 'Oddech', providerStatus: 'ready' }], nextCursor: null })
    vi.mocked(fetchAssetPreview).mockResolvedValue({ kind: 'audio', url: 'https://media.example.test/audio.mp3?token=temporary', expiresAt: '2026-09-22T18:00:00Z' })
    renderPage(['media.read'])
    fireEvent.click(await screen.findByRole('button', { name: 'Podgląd Oddech' }))
    expect(await screen.findByLabelText('Odsłuch Oddech')).toHaveAttribute('controls')
    expect(fetchAssetPreview).toHaveBeenCalledWith(asset.id, expect.any(AbortSignal))
  })
})


