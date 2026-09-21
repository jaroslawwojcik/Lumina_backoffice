import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { SessionAudioUpload } from './SessionAudioUpload'
import { completeAudioUpload, audioUploadConfiguration, uploadAudio } from './audioUploadApi'

vi.mock('./audioUploadApi', async (original) => ({ ...await original<typeof import('./audioUploadApi')>(), audioUploadConfiguration: vi.fn(), uploadAudio: vi.fn(), completeAudioUpload: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  vi.mocked(audioUploadConfiguration).mockResolvedValue({ enabled: true, maximumBytes: 100000, mimeTypes: ['audio/mpeg', 'audio/mp4'] })
  vi.mocked(uploadAudio).mockResolvedValue({ ticket: 'audio-ticket', audio: { durationSeconds: 120, bytes: 1000, mimeType: 'audio/mpeg' } })
})
function open() {
  const saved = vi.fn()
  render(<QueryClientProvider client={new QueryClient()}><SessionAudioUpload onSaved={saved} /></QueryClientProvider>)
  return saved
}
async function choose(type = 'audio/mpeg') {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Wybierz nagranie' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Plik głównego audio'), { target: { files: [new File(['audio'], 'audio.mp3', { type })] } })
}
it('requires a name and rejects video independently of the video uploader', async () => {
  open(); await choose('video/mp4')
  expect(await screen.findByText(/Wybierz nagranie MP3/)).toBeInTheDocument()
  expect(uploadAudio).not.toHaveBeenCalled()
  await choose()
  fireEvent.click(await screen.findByRole('button', { name: 'Prześlij nagranie' }))
  expect(await screen.findByText('Podaj nazwę od 1 do 200 znaków.')).toBeInTheDocument()
  expect(uploadAudio).not.toHaveBeenCalled()
})
it('does not persist an uploaded audio when cancelled before confirmation', async () => {
  open(); await choose()
  fireEvent.change(screen.getByLabelText(/Nazwa w bibliotece/), { target: { value: 'Okładka' } })
  fireEvent.click(screen.getByRole('button', { name: 'Prześlij nagranie' }))
  await screen.findByRole('button', { name: 'Zatwierdź nagranie' })
  expect(completeAudioUpload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(completeAudioUpload).not.toHaveBeenCalled()
})
it('saves only on confirmation and returns the audio asset for the new form', async () => {
  const result = { asset: { id: 'c0a80101-0000-7000-8000-000000000001', durationSeconds: 120, displayName: 'Okładka', providerStatus: 'ready' as const }, resourceId: null, revisionId: null }
  vi.mocked(completeAudioUpload).mockResolvedValue(result)
  const saved = open(); await choose()
  fireEvent.change(screen.getByLabelText(/Nazwa w bibliotece/), { target: { value: 'Okładka' } })
  fireEvent.click(screen.getByRole('button', { name: 'Prześlij nagranie' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź nagranie' }))
  await waitFor(() => expect(saved).toHaveBeenCalledWith(result))
  expect(completeAudioUpload).toHaveBeenCalledWith('audio-ticket', false)
})


