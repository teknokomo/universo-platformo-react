import { vi } from 'vitest'
import { fireEvent } from '@testing/frontend'

import { renderWithProviders, screen, waitFor } from '@testing/frontend'

import Profile from '../Profile.jsx'

const getAccessTokenMock = vi.fn(async () => 'token-123')

const authState = {
  user: { id: 'user-99', email: 'tester@example.com' },
  getAccessToken: getAccessTokenMock,
}

vi.mock('@ui/utils/authProvider', () => ({
  useAuth: () => authState,
}))

const profileResponse = {
  success: true,
  data: { nickname: 'Tester', first_name: 'Test', last_name: 'User' },
}

function createFetchMock(passwordResponse: Record<string, unknown> = { success: true }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/api/v1/profile/')) {
      return {
        ok: true,
        json: async () => profileResponse,
      } as Response
    }

    if (url.includes('/api/v1/auth/password')) {
      return {
        ok: true,
        json: async () => passwordResponse,
      } as Response
    }

    return {
      ok: true,
      json: async () => ({}),
    } as Response
  })
}

describe('Profile security flows', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    getAccessTokenMock.mockClear()
  })

  it('shows validation feedback when password confirmation mismatches', async () => {
    const fetchMock = createFetchMock()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(fetchMock as unknown as typeof fetch)

    await renderWithProviders(<Profile />, { withRouter: false })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    await waitFor(() =>
      expect(document.querySelectorAll('input[type="password"]').length).toBeGreaterThanOrEqual(3),
    )
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    const [currentPassword, newPassword, confirmPassword] = passwordInputs

    fireEvent.change(currentPassword, { target: { value: 'old-pass' } })
    fireEvent.change(newPassword, { target: { value: 'new-pass' } })
    fireEvent.change(confirmPassword, { target: { value: 'mismatch' } })

    const submit = screen.getByRole('button', { name: /updatePassword/i })
    fireEvent.click(submit)

    expect(await screen.findByText('passwordsDoNotMatch')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('sends password update request and renders success state', async () => {
    const fetchMock = createFetchMock({ success: true })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(fetchMock as unknown as typeof fetch)

    await renderWithProviders(<Profile />, { withRouter: false })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    await waitFor(() =>
      expect(document.querySelectorAll('input[type="password"]').length).toBeGreaterThanOrEqual(3),
    )
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    const [currentPassword, newPassword, confirmPassword] = passwordInputs

    fireEvent.change(currentPassword, { target: { value: 'old-pass' } })
    fireEvent.change(newPassword, { target: { value: 'new-pass' } })
    fireEvent.change(confirmPassword, { target: { value: 'new-pass' } })

    const submit = screen.getByRole('button', { name: /updatePassword/i })
    fireEvent.click(submit)

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/password'),
        expect.objectContaining({ method: 'PUT' }),
      ),
    )

    expect(await screen.findByText('passwordUpdated')).toBeInTheDocument()
  })
})
