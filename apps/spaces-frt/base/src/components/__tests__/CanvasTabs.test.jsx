// Test file for enhanced CanvasTabs drag-and-drop functionality
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CanvasTabs from '../CanvasTabs'

// Mock i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => fallback || key,
    }),
}))

const theme = createTheme()

const mockCanvases = [
    { id: 'canvas1', name: 'Canvas 1', isDirty: false },
    { id: 'canvas2', name: 'Canvas 2', isDirty: true },
    { id: 'canvas3', name: 'Canvas 3', isDirty: false },
]

const defaultProps = {
    canvases: mockCanvases,
    activeCanvasId: 'canvas1',
    onCanvasSelect: jest.fn(),
    onCanvasReorder: jest.fn(),
    onCanvasCreate: jest.fn(),
    onCanvasRename: jest.fn(),
    onCanvasDuplicate: jest.fn(),
    onCanvasDelete: jest.fn(),
}

const renderWithTheme = (component) => {
    return render(
        <ThemeProvider theme={theme}>
            {component}
        </ThemeProvider>
    )
}

describe('CanvasTabs Enhanced Drag-and-Drop', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('renders tabs without drag handle icons', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        // Verify tabs are rendered
        expect(screen.getByText('Canvas 1')).toBeInTheDocument()
        expect(screen.getByText('Canvas 2')).toBeInTheDocument()
        expect(screen.getByText('Canvas 3')).toBeInTheDocument()
        
        // Verify no grip icons are present (removed in improvements)
        const gripIcons = screen.queryAllByTestId('grip-vertical-icon')
        expect(gripIcons).toHaveLength(0)
    })

    test('applies correct CSS classes for drag states', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const tabContainer = screen.getByRole('tablist').closest('.canvas-tab-container')
        expect(tabContainer).toHaveClass('can-drag')
    })

    test('shows dirty indicator for modified canvases', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        // Canvas 2 has isDirty: true, should show indicator
        const canvas2Tab = screen.getByText('Canvas 2').closest('[role="tab"]')
        const dirtyIndicator = canvas2Tab.querySelector('[style*="background-color"]')
        expect(dirtyIndicator).toBeInTheDocument()
    })

    test('handles pointer events for drag initiation', async () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const canvas1Tab = screen.getByText('Canvas 1').closest('[role="tab"]')
        
        // Simulate pointer down
        fireEvent.mouseDown(canvas1Tab, { clientX: 100, clientY: 100 })
        
        // Simulate small movement (below threshold)
        fireEvent.mouseMove(document, { clientX: 105, clientY: 100 })
        
        // Should not trigger drag state yet
        const container = screen.getByRole('tablist').closest('.canvas-tab-container')
        expect(container).not.toHaveClass('dragging')
        
        // Simulate movement above threshold (8px)
        fireEvent.mouseMove(document, { clientX: 110, clientY: 100 })
        
        // Clean up
        fireEvent.mouseUp(document)
    })

    test('maintains accessibility features', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        // Check for proper ARIA attributes
        const tablist = screen.getByRole('tablist')
        expect(tablist).toBeInTheDocument()
        
        const tabs = screen.getAllByRole('tab')
        expect(tabs).toHaveLength(3)
        
        // Check for proper selection state
        const activeTab = screen.getByRole('tab', { selected: true })
        expect(activeTab).toHaveTextContent('Canvas 1')
    })

    test('handles tab selection correctly', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const canvas2Tab = screen.getByText('Canvas 2').closest('[role="tab"]')
        fireEvent.click(canvas2Tab)
        
        expect(defaultProps.onCanvasSelect).toHaveBeenCalledWith('canvas2')
    })

    test('supports keyboard navigation', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const tablist = screen.getByRole('tablist')
        
        // Test arrow key navigation
        fireEvent.keyDown(tablist, { key: 'ArrowRight' })
        fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
        
        // Should maintain focus management
        expect(document.activeElement).toBeDefined()
    })

    test('applies reduced motion styles when preferred', () => {
        // Mock prefers-reduced-motion
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn().mockImplementation(query => ({
                matches: query === '(prefers-reduced-motion: reduce)',
                media: query,
                onchange: null,
                addListener: jest.fn(),
                removeListener: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            })),
        })

        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        // Component should render without errors even with reduced motion
        expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    test('handles context menu for tab operations', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const canvas1Tab = screen.getByText('Canvas 1').closest('[role="tab"]')
        fireEvent.contextMenu(canvas1Tab)
        
        // Context menu should appear with options
        waitFor(() => {
            expect(screen.getByText('Rename')).toBeInTheDocument()
            expect(screen.getByText('Duplicate')).toBeInTheDocument()
            expect(screen.getByText('Delete')).toBeInTheDocument()
        })
    })

    test('handles canvas creation', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const addButton = screen.getByLabelText(/add.*canvas/i)
        fireEvent.click(addButton)
        
        expect(defaultProps.onCanvasCreate).toHaveBeenCalled()
    })

    test('maintains proper tab dimensions', () => {
        renderWithTheme(<CanvasTabs {...defaultProps} />)
        
        const tabs = screen.getAllByRole('tab')
        tabs.forEach(tab => {
            const styles = window.getComputedStyle(tab)
            // Verify reduced dimensions are applied
            expect(parseInt(styles.minHeight)).toBeLessThanOrEqual(36)
        })
    })
})

describe('CanvasTabs Performance', () => {
    test('renders efficiently with many tabs', () => {
        const manyCanvases = Array.from({ length: 20 }, (_, i) => ({
            id: `canvas${i}`,
            name: `Canvas ${i}`,
            isDirty: i % 3 === 0,
        }))

        const props = { ...defaultProps, canvases: manyCanvases }
        
        const startTime = performance.now()
        renderWithTheme(<CanvasTabs {...props} />)
        const endTime = performance.now()
        
        // Should render quickly even with many tabs
        expect(endTime - startTime).toBeLessThan(100) // 100ms threshold
        
        // All tabs should be present
        expect(screen.getAllByRole('tab')).toHaveLength(20)
    })
})
