import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor } from '@testing/frontend'

import Profile from '../Profile.jsx'

const getAccessTokenMock = vi.fn(async () => 'token-123')

const authState = {
  user: { id: 'user-99', email: 'tester@example.com' },
  getAccessToken: getAccessTokenMock,
}

vi.mock('@universo/auth-frt', () => ({
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

    const user = userEvent.setup()
    const currentPassword = await screen.findByLabelText(/current password/i)
    const newPassword = await screen.findByLabelText(/new password/i)
    const confirmPassword = await screen.findByLabelText(/confirm new password/i)

    await user.type(currentPassword, 'old-pass')
    await user.type(newPassword, 'new-pass')
    await user.type(confirmPassword, 'mismatch')

    const submit = screen.getByRole('button', { name: /update password/i })
    await user.click(submit)

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

    const user = userEvent.setup()
    const currentPassword = await screen.findByLabelText(/current password/i)
    const newPassword = await screen.findByLabelText(/new password/i)
    const confirmPassword = await screen.findByLabelText(/confirm new password/i)

    await user.type(currentPassword, 'old-pass')
    await user.type(newPassword, 'new-pass')
    await user.type(confirmPassword, 'new-pass')

    const submit = screen.getByRole('button', { name: /update password/i })
    await user.click(submit)

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/password'),
        expect.objectContaining({ method: 'PUT' }),
      ),
    )

    expect(await screen.findByText('passwordUpdated')).toBeInTheDocument()
  })
})
