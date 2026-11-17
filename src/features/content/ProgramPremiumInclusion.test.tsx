import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramEditorPage } from './ProgramAuthoringPages'
import { fetchProgramDraft, type ProgramDraft } from './programApi'
import { updateResource } from './resourceApi'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ permissions: ['content.edit'] }) }))
vi.mock('./programApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./programApi')>()), fetchProgramDraft: vi.fn() }))
vi.mock('./resourceApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./resourceApi')>()), updateResource: vi.fn() }))

const programId = 'c0a80101-0000-7000-8000-000000000003'
const draft: ProgramDraft = { programId, canonicalKey: 'tydzien-spokoju', status: 'draft', locale: 'pl', slug: 'tydzien-spokoju', title: 'Tydzień spokoju', summary: null, description: null, level: null, estimatedDays: null, version: 3, accessTier: 'purchase', includedInPremium: false, sortOrder: 0, featured: false, seoTitle: null, seoDescription: null, currentRevisionSnapshot: {}, sections: [] }

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/content/programs/${programId}`]}><Routes><Route path="/content/programs/:resourceId" element={<ProgramEditorPage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('program premium inclusion', () => {
  it('sends includedInPremium for a purchase-tier program', async () => {
    vi.mocked(fetchProgramDraft).mockResolvedValue(draft)
    vi.mocked(updateResource).mockResolvedValue({} as Awaited<ReturnType<typeof updateResource>>)
    renderEditor()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Dostępny w ramach Premium' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz dane katalogowe' }))
    await waitFor(() => expect(updateResource).toHaveBeenCalledWith(expect.objectContaining({ resourceId: programId, expectedVersion: 3, accessTier: 'purchase', includedInPremium: true })))
  })

  it('hides the option for other tiers and for APIs that do not expose the field', async () => {
    vi.mocked(fetchProgramDraft).mockResolvedValueOnce({ ...draft, accessTier: 'premium' })
    const first = renderEditor()
    await screen.findByRole('heading', { name: 'Tydzień spokoju' })
    expect(screen.queryByRole('checkbox', { name: 'Dostępny w ramach Premium' })).not.toBeInTheDocument()
    first.unmount()
    const legacy: ProgramDraft = { ...draft }
    delete legacy.includedInPremium
    vi.mocked(fetchProgramDraft).mockResolvedValueOnce(legacy)
    vi.mocked(updateResource).mockResolvedValue({} as Awaited<ReturnType<typeof updateResource>>)
    renderEditor()
    await screen.findByRole('heading', { name: 'Tydzień spokoju' })
    expect(screen.queryByRole('checkbox', { name: 'Dostępny w ramach Premium' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz dane katalogowe' }))
    await waitFor(() => expect(updateResource).toHaveBeenCalled())
    expect(vi.mocked(updateResource).mock.calls[0][0]).not.toHaveProperty('includedInPremium')
  })
})
