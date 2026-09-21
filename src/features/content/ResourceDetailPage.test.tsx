import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { ResourceDetailPage } from './ResourceDetailPage'
import { createResourceRevision, fetchResourceDetail, fetchResourceRevisionHistory } from './resourceApi'
import { fetchResourceAssets } from '../media/mediaApi'

vi.mock('./resourceApi', () => ({ fetchResourceDetail: vi.fn(), fetchResourceRevisionHistory: vi.fn(), createResourceRevision: vi.fn() }))
vi.mock('../media/mediaApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../media/mediaApi')>()), fetchResourceAssets: vi.fn(), fetchAssets: vi.fn(), assignResourceAsset: vi.fn() }))
const detail = { resourceId: 'resource-1', canonicalKey: 'poranna-joga', resourceType: 'session' as const, status: 'published', accessTier: 'premium', defaultLocale: 'pl-PL', version: 2, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-10T08:00:00Z', translation: { locale: 'pl-PL', slug: 'poranna-joga', title: 'Poranna joga', summary: null, description: null, seoTitle: null, seoDescription: null }, session: { mediaKind: 'video', durationSeconds: 1200, featured: false, intensity: null }, material: null, currentRevision: { revisionId: 'revision-2', revisionNumber: 2, note: null, createdAt: '2026-09-10T08:00:00Z', snapshot: { durationSeconds: 1200 } } }
const mockedDetail = vi.mocked(fetchResourceDetail); const mockedHistory = vi.mocked(fetchResourceRevisionHistory); const mockedCreate = vi.mocked(createResourceRevision); const mockedAssets = vi.mocked(fetchResourceAssets)
function renderPage(permissions: AuthState['permissions'] = ['content.edit']) { const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions, staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }; const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={['/content/sessions/resource-1']}><Routes><Route path="/content/sessions/:resourceId" element={<ResourceDetailPage expectedType="session" />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>) }
describe('ResourceDetailPage', () => { beforeEach(() => { vi.clearAllMocks() }); it('saves an object snapshot and refetches detail and history', async () => { mockedDetail.mockResolvedValue(detail); mockedHistory.mockResolvedValue([{ revisionId: 'revision-2', revisionNumber: 2, note: null, createdAt: '2026-09-10T08:00:00Z' }]); mockedCreate.mockResolvedValue(); renderPage(); await screen.findByText('Poranna joga'); fireEvent.change(screen.getByRole('textbox', { name: 'Zrzut JSON nowej rewizji' }), { target: { value: '{"durationSeconds": 1800}' } }); fireEvent.change(screen.getByRole('textbox', { name: 'Notatka do rewizji (opcjonalnie)' }), { target: { value: 'Dłuższa praktyka' } }); fireEvent.click(screen.getByRole('button', { name: 'Zapisz rewizję' })); await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(detail, { durationSeconds: 1800 }, 'Dłuższa praktyka')); await waitFor(() => expect(mockedDetail).toHaveBeenCalledTimes(2)); expect(mockedHistory).toHaveBeenCalledTimes(2) }); it('validates typed revision fields and preserves additional properties on save', async () => {
  mockedDetail.mockResolvedValue({ ...detail, currentRevision: { ...detail.currentRevision, snapshot: { durationSeconds: 1200, custom: { retained: true } } } })
  mockedHistory.mockResolvedValue([])
  mockedCreate.mockResolvedValue()
  renderPage()
  await screen.findByText('Poranna joga')
  fireEvent.change(screen.getByLabelText('Czas trwania (sekundy)'), { target: { value: '-5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz rewizję' }))
  expect(mockedCreate).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Czas trwania (sekundy)')).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(screen.getByLabelText('Czas trwania (sekundy)'), { target: { value: '1800' } })
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz rewizję' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ durationSeconds: 1800, custom: { retained: true } }), undefined))
}); it('shows assigned media only with media.read', async () => { mockedDetail.mockResolvedValue(detail); mockedHistory.mockResolvedValue([]); mockedAssets.mockResolvedValue([]); renderPage(['content.read', 'media.read']); expect(await screen.findByRole('heading', { name: 'Media' })).toBeInTheDocument(); expect(await screen.findByText('Brak przypisanych zasobów.')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Przypisz zasób' })).not.toBeInTheDocument() }); it('does not show the revision form without edit permission', async () => { mockedDetail.mockResolvedValue(detail); mockedHistory.mockResolvedValue([]); renderPage(['content.read']); await screen.findByText('Poranna joga'); expect(screen.queryByRole('button', { name: 'Zapisz rewizję' })).not.toBeInTheDocument() }); it('rejects JSON that is not an object', async () => { mockedDetail.mockResolvedValue(detail); mockedHistory.mockResolvedValue([]); renderPage(); await screen.findByText('Poranna joga'); fireEvent.change(screen.getByRole('textbox', { name: 'Zrzut JSON nowej rewizji' }), { target: { value: '[]' } }); fireEvent.click(screen.getByRole('button', { name: 'Zapisz rewizję' })); expect(await screen.findByText('Wprowadź poprawny obiekt JSON.')).toBeInTheDocument(); expect(mockedCreate).not.toHaveBeenCalled() }) })

