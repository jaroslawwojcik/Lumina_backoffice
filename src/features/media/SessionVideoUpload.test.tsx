import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionVideoUpload } from './SessionVideoUpload'
import { completeVideoUpload, prepareVideoUpload, videoUploadConfiguration, videoUploadStatus } from './videoUploadApi'

const transfer = vi.hoisted(() => ({ start: vi.fn(), abort: vi.fn().mockResolvedValue(undefined), options: undefined as undefined | { onSuccess: () => void; onProgress: (sent: number, total: number) => void; storeFingerprintForResuming: boolean } }))
vi.mock('tus-js-client', () => ({ Upload: class { constructor(_file: File, options: typeof transfer.options) { transfer.options = options } start = transfer.start; abort = transfer.abort } }))
vi.mock('./videoUploadApi', async (original) => ({ ...await original<typeof import('./videoUploadApi')>(), videoUploadConfiguration: vi.fn(), prepareVideoUpload: vi.fn(), videoUploadStatus: vi.fn(), completeVideoUpload: vi.fn() }))
const id = 'c0a80101-0000-7000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(videoUploadConfiguration).mockResolvedValue({ enabled: true, maximumBytes: 10000, mimeTypes: ['video/mp4'] })
  vi.mocked(prepareVideoUpload).mockResolvedValue({ ticket: 'opaque-ticket', credentials: { videoId: id, libraryId: '123', signature: 'signature', expiresAt: 1900000000, endpoint: 'https://video.bunnycdn.com/tusupload' } })
  vi.mocked(videoUploadStatus).mockResolvedValue({ status: 'processing', encodeProgress: 50, durationSeconds: null, width: null, height: null })
})
function open() {
  const saved = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><SessionVideoUpload onSaved={saved} /></QueryClientProvider>)
  return saved
}
async function choose() {
  await waitFor(() => expect(screen.getByLabelText('Plik głównego wideo').closest('label')).not.toHaveAttribute('aria-disabled', 'true'))
  fireEvent.change(screen.getByLabelText('Plik głównego wideo'), { target: { files: [new File(['video'], 'film.mp4', { type: 'video/mp4' })] } })
  await screen.findByRole('dialog')
}
describe('session video upload', () => {
  it('requires an editorial name before preparing any transfer', async () => {
    open(); await choose()
    expect(prepareVideoUpload).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/Nazwa w bibliotece/), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Prześlij film' }))
    expect((await screen.findAllByText(/Nazwa w bibliotece jest wymagana/)).length).toBeGreaterThan(0)
    expect(prepareVideoUpload).not.toHaveBeenCalled()
  })
  it('does not save while processing and cancels without database finalization', async () => {
    open(); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Prześlij film' }))
    await waitFor(() => expect(transfer.start).toHaveBeenCalled())
    expect(transfer.options?.storeFingerprintForResuming).toBe(false)
    await act(async () => { transfer.options!.onSuccess() })
    expect(await screen.findByText(/Trwa przetwarzanie filmu/)).toBeInTheDocument()
    expect(completeVideoUpload).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Anuluj upload' }))
    await waitFor(() => expect(transfer.abort).toHaveBeenCalled())
    expect(completeVideoUpload).not.toHaveBeenCalled()
  })
  it('pauses and resumes the same transfer and only saves confirmed ready video', async () => {
    const saved = open(); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Prześlij film' }))
    await waitFor(() => expect(transfer.start).toHaveBeenCalledTimes(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Wstrzymaj' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Wznów' }))
    expect(transfer.start).toHaveBeenCalledTimes(2)
    expect(prepareVideoUpload).toHaveBeenCalledTimes(1)
    vi.mocked(videoUploadStatus).mockResolvedValue({ status: 'ready', encodeProgress: 100, durationSeconds: 123, width: 1920, height: 1080 })
    vi.mocked(completeVideoUpload).mockResolvedValue({ asset: { id, displayName: 'Film', durationSeconds: 123, providerStatus: 'ready' }, resourceId: null, revisionId: null })
    await act(async () => { transfer.options!.onSuccess() })
    fireEvent.click(await screen.findByRole('button', { name: 'Dodaj gotowy film do sesji' }))
    await waitFor(() => expect(saved).toHaveBeenCalled())
    expect(completeVideoUpload).toHaveBeenCalledWith('opaque-ticket', false)
  })
})
