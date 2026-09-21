import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'test-user' }, signIn: vi.fn() }) }))
function Destination() { const location = useLocation(); return <output>{location.pathname}{location.search}</output> }
function open(from: { pathname: string; search?: string }) { render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>) }

describe('LoginPage', () => {
  it('returns to the requested form after signing in', () => { open({ pathname: '/content/sessions', search: '?status=draft' }); expect(screen.getByRole('status')).toHaveTextContent('/content/sessions?status=draft') })
  it('does not redirect to an external destination', () => { open({ pathname: '//example.test' }); expect(screen.getByRole('status')).toHaveTextContent('/') })
})

