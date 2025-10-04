import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor } from '@testing/frontend'

import UnikDetail from '../UnikDetail.jsx'

const { navigateMock, apiGetMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    apiGetMock: vi.fn(async () => ({ data: { name: 'Test Unik' } }))
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useParams: () => ({ unikId: 'unik-123' }),
        useNavigate: () => navigateMock
    }
})

vi.mock('../../../../../../packages/ui/src/api', () => ({
    __esModule: true,
    default: {
        get: apiGetMock
    }
}))

describe('UnikDetail', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        apiGetMock.mockClear()
    })

    it('renders unik dashboard actions and navigates via shortcuts', async () => {
        await renderWithProviders(<UnikDetail />, {
            withRouter: false,
            withRedux: false
        })

        await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/unik/unik-123'))

        expect(await screen.findByText(/unikDetail.dashboard/i)).toBeInTheDocument()

        const manageAccounts = screen.getByRole('button', { name: /unikDetail.manageAccounts/i })
        await userEvent.click(manageAccounts)
        expect(navigateMock).toHaveBeenCalledWith('/unik/unik-123/finance/accounts')

        navigateMock.mockReset()

        const backButton = screen.getByRole('button', { name: /unikDetail.back/i })
        await userEvent.click(backButton)
        expect(navigateMock).toHaveBeenCalledWith('/uniks')
    })
})
