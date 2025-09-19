import React from 'react'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor, within } from '@testing/frontend'

import Analytics from '../Analytics.jsx'

const { getSpacesMock, getCanvasesMock, getLeadsMock } = vi.hoisted(() => ({
  getSpacesMock: vi.fn(async () => ({ data: [{ id: 'space-1', name: 'Demo Space' }] })),
  getCanvasesMock: vi.fn(async () => ({ data: [{ id: 'canvas-1', name: 'Demo Canvas' }] })),
  getLeadsMock: vi.fn(async () => ({
    data: [
      {
        name: 'Alice',
        email: 'alice@example.com',
        points: 10,
        createdDate: '2024-01-01T00:00:00.000Z',
        chatflowid: 'abcdefgh',
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        phone: '200',
        createdDate: '2024-01-02T00:00:00.000Z',
        chatflowid: 'ijklmnop',
      },
    ],
  })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ unikId: 'unik-1' }),
  }
})

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector({ customization: {} }),
  useDispatch: () => vi.fn(),
}))

vi.mock('@/utils/useNotifier', () => ({
  __esModule: true,
  default: vi.fn(),
}))

vi.mock('@/store/actions', () => ({
  enqueueSnackbar: (...args: unknown[]) => ({ type: 'enqueue', args }),
  closeSnackbar: (...args: unknown[]) => ({ type: 'close', args }),
}))

vi.mock('@universo/spaces-frt', () => ({
  spacesApi: {
    getSpaces: getSpacesMock,
    getCanvases: getCanvasesMock,
  },
}))

vi.mock('@/api/lead', () => ({
  __esModule: true,
  default: {
    getAllLeads: getLeadsMock,
  },
}))

describe('Analytics dashboard', () => {
  beforeEach(() => {
    getSpacesMock.mockClear()
    getCanvasesMock.mockClear()
    getLeadsMock.mockClear()
  })

  it('renders analytics summary and lead table once data resolves', async () => {
    await renderWithProviders(<Analytics />, {
      withRouter: false,
      withRedux: false,
    })

    await waitFor(() => expect(getSpacesMock).toHaveBeenCalledWith('unik-1'))
    await waitFor(() => expect(getCanvasesMock).toHaveBeenCalledWith('unik-1', 'space-1'))
    await waitFor(() => expect(getLeadsMock).toHaveBeenCalledWith('canvas-1'))

    await waitFor(() => {
      const metrics = screen
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent)
      expect(metrics).toEqual(expect.arrayContaining(['2', '105', '200', '210']))
    })

    const table = await screen.findByRole('table', { name: /analytics table/i })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Alice')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Bob')).toBeInTheDocument()

  })
})
