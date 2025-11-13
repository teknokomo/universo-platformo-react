import React from 'react'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { renderWithProviders, screen, waitFor, within } from '@testing/frontend'

import Analytics from '../Analytics.jsx'

const leadsFixture = [
  {
    name: 'Alice',
    email: 'alice@example.com',
    points: 10,
    createdDate: '2024-01-01T00:00:00.000Z',
    canvasId: 'abcdefgh',
  },
  {
    name: 'Bob',
    email: 'bob@example.com',
    phone: '200',
    createdDate: '2024-01-02T00:00:00.000Z',
    canvasId: 'ijklmnop',
  },
]

const expectedMetrics = (() => {
  const points = leadsFixture
    .map((lead) => (typeof lead.points === 'number' ? lead.points : Number.parseInt(lead.phone ?? '', 10)))
    .filter((value) => Number.isFinite(value))

  const totalPoints = points.reduce((total, value) => total + value, 0)
  const averagePoints =
    points.length > 0 ? Math.round((totalPoints / points.length) * 100) / 100 : 0
  return {
    totalLeads: leadsFixture.length,
    averagePoints,
    maxPoints: points.length > 0 ? Math.max(...points) : 0,
    totalPoints,
  }
})()

const { getSpacesMock, getCanvasesMock, getLeadsMock } = vi.hoisted(() => ({
  getSpacesMock: vi.fn(async () => ({ data: [{ id: 'space-1', name: 'Demo Space' }] })),
  getCanvasesMock: vi.fn(async () => ({ data: [{ id: 'canvas-1', name: 'Demo Canvas' }] })),
  getLeadsMock: vi.fn(async () => ({
    data: leadsFixture,
  })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('analytics:react-router-dom')>('react-router-dom')
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
    getCanvasLeads: getLeadsMock,
  },
}))

describe('Analytics dashboard', () => {
  beforeEach(() => {
    getSpacesMock.mockClear()
    getCanvasesMock.mockClear()
    getLeadsMock.mockClear()
  })

  it('analytics:renders analytics summary and lead table once data resolves', async () => {
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
      expect(metrics).toEqual(
        expect.arrayContaining([
          String(expectedMetrics.totalLeads),
          String(expectedMetrics.averagePoints),
          String(expectedMetrics.maxPoints),
          String(expectedMetrics.totalPoints),
        ]),
      )
    })

    const table = await screen.findByRole('table', { name: /analytics table/i })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('analytics:Alice')).toBeInTheDocument()
    expect(within(rows[2]).getByText('analytics:Bob')).toBeInTheDocument()

  })
})
