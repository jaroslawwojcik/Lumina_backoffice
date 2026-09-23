import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateResourcePage } from './CreateResourcePage'
import { createSession } from './resourceApi'
import { fetchAssets } from '../media/mediaApi'

vi.mock('./resourceApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./resourceApi')>()), createSession: vi.fn() }))
vi.mock('../media/mediaApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../media/mediaApi')>()), fetchAssets: vi.fn() }))

const mockedCreateSession = vi.mocked(createSession)
const mockedFetchAssets = vi.mocked(fetchAssets)
const auth = vi.hoisted(() => ({ permissions: ['content.create'] as string[] }))

function LocationDisplay() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/content/sessions/new']}><Routes><Route path="/content/sessions/new" element={<CreateResourcePage resourceType="session" />} /><Route path="*" element={<LocationDisplay />} /></Routes></MemoryRouter></QueryClientProvider>)
  return { invalidateQueries }
}

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ permissions: auth.permissions }) }))

describe('CreateResourcePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.permissions = ['content.create']
  })

  it('does not submit when the first revision is not a JSON object', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/Klucz kanoniczny/), { target: { value: 'oddech-wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'oddech-wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Tytuł/), { target: { value: 'Oddech wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Czas trwania \(sekundy\)/), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText(/Zrzut JSON pierwszej rewizji/), { target: { value: '[]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz sesję' }))
    expect(await screen.findByText('Wprowadź poprawny obiekt JSON.')).toBeInTheDocument()
    expect(mockedCreateSession).not.toHaveBeenCalled()
  })

  it('creates a session, invalidates resources, and opens its detail page', async () => {
    mockedCreateSession.mockResolvedValue({ resourceId: 'session-1', revisionId: 'revision-1', revisionNumber: 1 })
    const { invalidateQueries } = renderPage()
    fireEvent.change(screen.getByLabelText(/Klucz kanoniczny/), { target: { value: 'oddech-wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'oddech-wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Tytuł/), { target: { value: 'Oddech wieczorny' } })
    fireEvent.change(screen.getByLabelText(/Czas trwania \(sekundy\)/), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText(/Zrzut JSON pierwszej rewizji/), { target: { value: '{"mediaId":"media-1"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz sesję' }))
    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledWith({ canonicalKey: 'oddech-wieczorny', locale: 'pl', slug: 'oddech-wieczorny', title: 'Oddech wieczorny', mediaKind: 'video', durationSeconds: 600, snapshot: { mediaId: 'media-1' }, accessTier: 'free' }))
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['resources'] }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/content/sessions/session-1')
  })

  it('creates a session with existing video and image assets from the media library', async () => {
    auth.permissions = ['content.create', 'media.read']
    mockedFetchAssets.mockImplementation(async ({ kind }) => ({ items: kind === 'video' ? [{ id: '10000000-0000-4000-8000-000000000001', kind: 'video', provider: 'bunny_stream', externalId: 'video-1', storageKey: null, publicUrl: null, mimeType: 'video/mp4', bytes: 1000, width: 1920, height: 1080, durationSeconds: 8, createdAt: '2026-09-24T08:00:00Z', displayName: 'Film testowy', providerStatus: 'ready' }] : [{ id: '10000000-0000-4000-8000-000000000002', kind: 'image', provider: 'bunny_storage', externalId: null, storageKey: 'thumbnails/test.jpg', publicUrl: 'https://cdn.example.test/test.jpg', mimeType: 'image/jpeg', bytes: 500, width: 1280, height: 720, durationSeconds: null, createdAt: '2026-09-24T08:00:00Z', displayName: 'Okładka testowa', providerStatus: 'ready' }], nextCursor: null }))
    mockedCreateSession.mockResolvedValue({ resourceId: 'session-1', revisionId: 'revision-1', revisionNumber: 1 })
    renderPage()

    fireEvent.change(screen.getByLabelText(/Klucz kanoniczny/), { target: { value: 'test' } })
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'test' } })
    fireEvent.change(screen.getByLabelText(/Tytuł/), { target: { value: 'Test' } })
    const videoPicker = await screen.findByLabelText('Wideo z biblioteki')
    await waitFor(() => expect(videoPicker).toBeEnabled())
    fireEvent.mouseDown(videoPicker)
    fireEvent.click(await screen.findByRole('option', { name: 'Film testowy · 8 s' }))
    const imagePicker = screen.getByLabelText('Obrazek z biblioteki')
    await waitFor(() => expect(imagePicker).toBeEnabled())
    fireEvent.mouseDown(imagePicker)
    fireEvent.click(await screen.findByRole('option', { name: 'Okładka testowa · 1280×720' }))
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz sesję' }))

    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      primaryAssetId: '10000000-0000-4000-8000-000000000001',
      thumbnailAssetId: '10000000-0000-4000-8000-000000000002',
      durationSeconds: 8,
    })))
  })

  it('uses an existing audio asset and its confirmed duration', async () => {
    auth.permissions = ['content.create', 'media.read']
    mockedFetchAssets.mockImplementation(async ({ kind }) => ({ items: kind === 'audio' ? [{ id: '10000000-0000-4000-8000-000000000003', kind: 'audio', provider: 'bunny_storage', externalId: null, storageKey: 'audio/test.mp3', publicUrl: null, mimeType: 'audio/mpeg', bytes: 1000, width: null, height: null, durationSeconds: 125, createdAt: '2026-09-24T08:00:00Z', displayName: 'Oddech testowy', providerStatus: 'ready' }] : [], nextCursor: null }))
    mockedCreateSession.mockResolvedValue({ resourceId: 'session-1', revisionId: 'revision-1', revisionNumber: 1 })
    renderPage()

    fireEvent.change(screen.getByLabelText(/Klucz kanoniczny/), { target: { value: 'audio-test' } })
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'audio-test' } })
    fireEvent.change(screen.getByLabelText(/Tytuł/), { target: { value: 'Audio test' } })
    fireEvent.mouseDown(screen.getByLabelText('Format sesji'))
    fireEvent.click(await screen.findByRole('option', { name: 'Audio' }))
    const audioPicker = await screen.findByLabelText('Audio z biblioteki')
    await waitFor(() => expect(audioPicker).toBeEnabled())
    fireEvent.mouseDown(audioPicker)
    fireEvent.click(await screen.findByRole('option', { name: 'Oddech testowy · 125 s' }))
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz sesję' }))

    await waitFor(() => expect(mockedCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      mediaKind: 'audio',
      primaryAssetId: '10000000-0000-4000-8000-000000000003',
      durationSeconds: 125,
    })))
  })
})

