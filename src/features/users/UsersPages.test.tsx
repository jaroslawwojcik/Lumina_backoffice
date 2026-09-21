import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../../auth/authContext'
import { UserDetailPage } from './UsersPages'
import { fetchUser, fetchUserOrders } from './userApi'

vi.mock('./userApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./userApi')>()), fetchUser: vi.fn(), fetchUserOrders: vi.fn() }))

const userId = 'c0a80101-0000-7000-8000-000000000401'
const mockedFetchUser = vi.mocked(fetchUser)
const mockedFetchUserOrders = vi.mocked(fetchUserOrders)
const authState: AuthState = { isLoading: false, user: null, displayName: 'Test', permissions: ['users.read'], staffAccess: 'authorized', signIn: vi.fn(), signOut: vi.fn(), retryStaffContext: vi.fn() }

function renderPage() { const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={queryClient}><AuthContext.Provider value={authState}><MemoryRouter initialEntries={[`/users/${userId}`]}><Routes><Route path="/users/:userId" element={<UserDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>) }

describe('UserDetailPage', () => {
  it('hides access without access.read and loads paged orders on demand', async () => {
    mockedFetchUser.mockResolvedValue({ userId, authProvider: 'firebase', authSubject: 'subject', email: 'alicja@example.test', displayName: 'Alicja Kowalska', firstName: 'Alicja', lastName: 'Kowalska', locale: 'pl-PL', timeZone: 'Europe/Warsaw', notificationsEnabled: true, theme: 'system', createdAt: '2026-09-01T08:30:00Z', updatedAt: '2026-09-10T08:30:00Z' })
    mockedFetchUserOrders.mockResolvedValue({ items: [{ orderId: 'c0a80101-0000-7000-8000-000000000402', productId: 'c0a80101-0000-7000-8000-000000000403', productTitle: 'Tydzień spokoju', targetProgramResourceId: 'c0a80101-0000-7000-8000-000000000404', currency: 'PLN', amountInGrosze: 4990, status: 'completed', createdAt: '2026-09-01T08:30:00Z', updatedAt: '2026-09-01T08:30:00Z', completedAt: '2026-09-01T08:35:00Z', failureCode: null }], nextCursor: null })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Alicja Kowalska' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Profil użytkownika (JSON)')).toHaveTextContent('alicja@example.test')
    expect(screen.queryByRole('tab', { name: 'Dostęp' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Zamówienia' }))
    await waitFor(() => expect(mockedFetchUserOrders).toHaveBeenCalledWith(userId, { pageSize: 25 }, expect.any(AbortSignal)))
    expect(await screen.findByText('49,90 zł')).toBeInTheDocument()
  })
})

