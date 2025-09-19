import React from 'react'
import { describe, beforeAll, afterAll, beforeEach, test, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, fireEvent, waitFor } from '@testing/frontend'

import CanvasTabs from '../CanvasTabs'

type Canvas = {
  id: string
  name: string
  isDirty?: boolean
}

type CanvasTabsProps = {
  canvases: Canvas[]
  activeCanvasId: string
  onCanvasSelect: (id: string) => void
  onCanvasReorder: (id: string, position: number) => Promise<void> | void
  onCanvasCreate: () => void
  onCanvasRename: (id: string, name: string) => void
  onCanvasDuplicate: (id: string) => void
  onCanvasDelete: (id: string) => void
  disabled?: boolean
  onHeightChange: (height: number) => void
}

const mockCanvases: Canvas[] = [
  { id: 'canvas1', name: 'Canvas 1', isDirty: false },
  { id: 'canvas2', name: 'Canvas 2', isDirty: true },
  { id: 'canvas3', name: 'Canvas 3', isDirty: false },
]

declare global {
  interface Window {
    matchMedia(query: string): MediaQueryList
  }
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
})

function createProps(overrides: Partial<CanvasTabsProps> = {}): CanvasTabsProps {
  return {
    canvases: mockCanvases,
    activeCanvasId: 'canvas1',
    onCanvasSelect: vi.fn(),
    onCanvasReorder: vi.fn().mockResolvedValue(undefined),
    onCanvasCreate: vi.fn(),
    onCanvasRename: vi.fn(),
    onCanvasDuplicate: vi.fn(),
    onCanvasDelete: vi.fn(),
    disabled: false,
    onHeightChange: vi.fn(),
    ...overrides,
  }
}

describe('CanvasTabs', () => {
  test('renders tabs and highlights dirty canvases', async () => {
    const props = createProps()
    await renderWithProviders(<CanvasTabs {...props} />, {
      withRedux: false,
      withRouter: false,
      withI18n: false,
    })

    // У "чистой" вкладки не должно быть соседнего элемента-индикатора
    expect(screen.getByText('Canvas 1').nextElementSibling).toBeNull()
    // У "грязной" вкладки должен быть соседний элемент-индикатор
    expect(screen.getByText('Canvas 2').nextElementSibling).toBeInTheDocument()
  })

  test('calls onCanvasSelect when a tab is clicked', async () => {
    const props = createProps()
    await renderWithProviders(<CanvasTabs {...props} />, {
      withRedux: false,
      withRouter: false,
      withI18n: false,
    })

    const user = userEvent.setup()
    const secondTabButton = await screen.findByRole('tab', { name: 'Canvas 2' })
    await user.click(secondTabButton)

    expect(props.onCanvasSelect).toHaveBeenCalledWith('canvas2')
  })

  test('reorders canvases to the right via the context menu', async () => {
    const props = createProps()
    await renderWithProviders(<CanvasTabs {...props} />, {
      withRedux: false,
      withRouter: false,
      withI18n: false,
    })

    const user = userEvent.setup()
    const secondTab = await screen.findByRole('tab', { name: 'Canvas 2' })
    fireEvent.contextMenu(secondTab)

    await user.click((await screen.findAllByRole('menuitem'))[1])

    await waitFor(() => expect(props.onCanvasReorder).toHaveBeenCalledWith('canvas2', 2))
  })

  test('triggers canvas duplication from the context menu', async () => {
    const props = createProps()
    await renderWithProviders(<CanvasTabs {...props} />, {
      withRedux: false,
      withRouter: false,
      withI18n: false,
    })

    const user = userEvent.setup()
    fireEvent.contextMenu(await screen.findByRole('tab', { name: 'Canvas 2' }))

    await user.click(await screen.findByText('Duplicate'))

    expect(props.onCanvasDuplicate).toHaveBeenCalledWith('canvas2')
  })

  test('calls onCanvasCreate when the add button is pressed', async () => {
    const props = createProps()
    await renderWithProviders(<CanvasTabs {...props} />, {
      withRedux: false,
      withRouter: false,
      withI18n: false,
    })

    const user = userEvent.setup()
    await user.click(screen.getByLabelText(/create canvas/i))

    expect(props.onCanvasCreate).toHaveBeenCalledTimes(1)
  })
})
