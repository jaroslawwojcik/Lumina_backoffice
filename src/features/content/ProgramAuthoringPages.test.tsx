import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CreateProgramPage, ProgramEditorPage } from './ProgramAuthoringPages'
import { createProgram, createProgramSection, fetchProgramDraft } from './programApi'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ permissions: ['content.edit', 'curriculum.edit'] }) }))
vi.mock('./programApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./programApi')>()), createProgram: vi.fn(), createProgramSection: vi.fn(), fetchProgramDraft: vi.fn() }))

const mockedCreateProgram = vi.mocked(createProgram)
const mockedCreateProgramSection = vi.mocked(createProgramSection)
const mockedFetchProgramDraft = vi.mocked(fetchProgramDraft)

function LocationDisplay() { return <output data-testid="location">{useLocation().pathname}</output> }
function wrapper(children: React.ReactNode, entry: string) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><Routes>{children}<Route path="*" element={<LocationDisplay />} /></Routes></MemoryRouter></QueryClientProvider>) }

describe('program authoring', () => {
  it('creates a program with the backend command fields and opens its editor', async () => {
    mockedCreateProgram.mockResolvedValue({ resourceId: 'c0a80101-0000-7000-8000-000000000003', revisionId: 'c0a80101-0000-7000-8000-000000000101', revisionNumber: 1 })
    wrapper(<Route path="/content/programs/new" element={<CreateProgramPage />} />, '/content/programs/new')
    fireEvent.change(screen.getByLabelText(/Klucz kanoniczny/), { target: { value: 'wieczorny-spokoj' } })
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'wieczorny-spokoj' } })
    fireEvent.change(screen.getByLabelText(/Tytuł/), { target: { value: 'Wieczorny spokój' } })
    fireEvent.change(screen.getByLabelText(/Szacowany czas/), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText(/Zrzut JSON pierwszej rewizji/), { target: { value: '{"cover":"asset-1"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz program' }))
    await waitFor(() => expect(mockedCreateProgram.mock.calls[0]?.[0]).toEqual({ canonicalKey: 'wieczorny-spokoj', locale: 'pl', slug: 'wieczorny-spokoj', title: 'Wieczorny spokój', estimatedDays: 7, snapshot: { cover: 'asset-1' }, accessTier: 'free' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/content/programs/c0a80101-0000-7000-8000-000000000003')
  })

  it('creates a section using the exact curriculum payload', async () => {
    mockedFetchProgramDraft.mockResolvedValue({ programId: 'c0a80101-0000-7000-8000-000000000003', canonicalKey: 'tydzien-spokoju', status: 'draft', locale: 'pl-pl', slug: 'tydzien-spokoju', title: 'Tydzień spokoju', summary: null, description: null, level: null, estimatedDays: null, version: 1, accessTier: 'free', sortOrder: 0, featured: false, seoTitle: null, seoDescription: null, currentRevisionSnapshot: {}, sections: [] })
    mockedCreateProgramSection.mockResolvedValue()
    wrapper(<Route path="/content/programs/:resourceId" element={<ProgramEditorPage />} />, '/content/programs/c0a80101-0000-7000-8000-000000000003')
    await screen.findByRole('heading', { name: 'Tydzień spokoju' })
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sekcję' }))
    fireEvent.change(screen.getByLabelText(/Tytuł sekcji/), { target: { value: 'Oddech' } })
    fireEvent.change(screen.getByLabelText(/Identyfikator zasobu/), { target: { value: 'c0a80101-0000-7000-8000-000000000001' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Dodaj sekcję' }).find((button) => button.getAttribute('type') === 'submit')!)
    await waitFor(() => expect(mockedCreateProgramSection.mock.calls[0]?.[0]).toEqual({ programId: 'c0a80101-0000-7000-8000-000000000003', locale: 'pl', title: 'Oddech', entries: [{ resourceId: 'c0a80101-0000-7000-8000-000000000001', inheritProgramAccess: true, isOptional: false }] }))
  })
})

