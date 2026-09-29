import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { ContentAssistantPage } from './ContentAssistantPage'
import { fetchDraft, fetchDrafts, fetchProviders, sendMessage, type AssistantDraft } from './assistantApi'

vi.mock('./assistantApi', async (original) => ({ ...(await original<typeof import('./assistantApi')>()), fetchDraft: vi.fn(), fetchDrafts: vi.fn(), fetchProviders: vi.fn(), sendMessage: vi.fn() }))
const id = 'c0a80101-0000-7000-8000-000000000001'
const draft: AssistantDraft = {
  id, kind: 'session', status: 'draft', version: 1, messages: [], primaryAssetId: null, thumbnailAssetId: null, accessTier: null, resourceId: null, revisionId: null, missingFields: ['title'], updatedAt: '2026-09-28T00:00:00Z',
  proposal: { canonicalKey: '', locale: 'pl', slug: '', title: '', summary: null, description: null, mediaKind: 'video', durationSeconds: null, level: null, estimatedDays: null, publicMetadata: { style: null, intents: [], focusAreas: [], equipment: [], instructorDisplayName: null }, sections: [] },
}
const auth: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions: ['content.create'], staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}><MemoryRouter initialEntries={[`/assistant?draft=${id}`]}><ContentAssistantPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchDraft).mockResolvedValue(draft)
  vi.mocked(fetchDrafts).mockResolvedValue([draft])
  vi.mocked(fetchProviders).mockResolvedValue([{ id: 'copilot', models: ['copilot-test'] }])
  vi.mocked(sendMessage).mockResolvedValue({ ...draft, version: 2, messages: [{ role: 'assistant', content: 'Jaki jest cel sesji?' }] })
})
afterEach(cleanup)
describe('Copilot content assistant', () => {
  it('sends through Copilot without provider or model selectors', async () => {
    renderPage()
    await screen.findByText('Rozmowę prowadzi GitHub Copilot.')
    expect(screen.queryByLabelText('Dostawca')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Model')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Wiadomość'), { target: { value: 'Przygotuj sesję oddechową' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij' }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(id, expect.objectContaining({ message: 'Przygotuj sesję oddechową', expectedVersion: 1 })))
    expect(await screen.findByText('Jaki jest cel sesji?')).toBeInTheDocument()
  })
  it('does not fall back to other providers when Copilot is unavailable', async () => {
    vi.mocked(fetchProviders).mockResolvedValue([{ id: 'openai', models: ['other'] }])
    renderPage()
    expect(await screen.findByText(/GitHub Copilot jest niedostępny/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zapisz pliki i dostęp w szkicu' })).toBeEnabled()
  })
  it('distinguishes a status request failure from missing configuration', async () => {
    vi.mocked(fetchProviders).mockRejectedValue(new Error('offline'))
    renderPage()
    expect(await screen.findByText(/Nie udało się sprawdzić dostępności GitHub Copilot/)).toBeInTheDocument()
    expect(screen.queryByText(/GitHub Copilot jest niedostępny/)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })
})
