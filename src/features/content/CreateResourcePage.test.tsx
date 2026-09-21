import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CreateResourcePage } from './CreateResourcePage'
import { createSession } from './resourceApi'

vi.mock('./resourceApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./resourceApi')>()), createSession: vi.fn() }))

const mockedCreateSession = vi.mocked(createSession)

function LocationDisplay() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/content/sessions/new']}><Routes><Route path="/content/sessions/new" element={<CreateResourcePage resourceType="session" />} /><Route path="*" element={<LocationDisplay />} /></Routes></MemoryRouter></QueryClientProvider>)
  return { invalidateQueries }
}

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ permissions: ['content.create'] }) }))

describe('CreateResourcePage', () => {
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
})

