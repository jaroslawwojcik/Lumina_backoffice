import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThumbnailImageUpload } from './ThumbnailImageUpload'
import { completeImageUpload, imageUploadConfiguration, uploadImage } from './imageUploadApi'

vi.mock('./imageUploadApi', async (original) => ({ ...await original<typeof import('./imageUploadApi')>(), imageUploadConfiguration: vi.fn(), uploadImage: vi.fn(), completeImageUpload: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  vi.mocked(imageUploadConfiguration).mockResolvedValue({ enabled: true, maximumBytes: 100000, mimeTypes: ['image/png', 'image/jpeg'] })
  vi.mocked(uploadImage).mockResolvedValue({ ticket: 'image-ticket', image: { publicUrl: 'https://images.example.com/a.png', width: 1200, height: 800 } })
})
function open() {
  const saved = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><ThumbnailImageUpload onSaved={saved} /></QueryClientProvider>)
  return saved
}
async function choose(type = 'image/png') {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Wybierz obraz' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Wybierz obrazek kafelka'), { target: { files: [new File(['image'], 'image.png', { type })] } })
}
it('requires a name and rejects video independently of the video uploader', async () => {
  open(); await choose('video/mp4')
  expect(await screen.findByText(/Film dodaj w osobnym polu/)).toBeInTheDocument()
  expect(uploadImage).not.toHaveBeenCalled()
  await choose()
  fireEvent.click(await screen.findByRole('button', { name: 'Prześlij obraz' }))
  expect(await screen.findByText('Podaj nazwę od 1 do 200 znaków.')).toBeInTheDocument()
  expect(uploadImage).not.toHaveBeenCalled()
})
it('does not persist an uploaded image when cancelled before confirmation', async () => {
  open(); await choose()
  fireEvent.change(screen.getByLabelText(/Nazwa w bibliotece/), { target: { value: 'Okładka' } })
  fireEvent.click(screen.getByRole('button', { name: 'Prześlij obraz' }))
  await screen.findByRole('button', { name: 'Zatwierdź obraz' })
  expect(completeImageUpload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(completeImageUpload).not.toHaveBeenCalled()
})
it('saves only on confirmation and returns the thumbnail for the new form', async () => {
  const result = { asset: { id: 'c0a80101-0000-7000-8000-000000000001', publicUrl: 'https://images.example.com/a.png', displayName: 'Okładka', providerStatus: 'ready' as const }, resourceId: null, revisionId: null }
  vi.mocked(completeImageUpload).mockResolvedValue(result)
  const saved = open(); await choose()
  fireEvent.change(screen.getByLabelText(/Nazwa w bibliotece/), { target: { value: 'Okładka' } })
  fireEvent.click(screen.getByRole('button', { name: 'Prześlij obraz' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź obraz' }))
  await waitFor(() => expect(saved).toHaveBeenCalledWith(result))
  expect(completeImageUpload).toHaveBeenCalledWith('image-ticket', false)
})
