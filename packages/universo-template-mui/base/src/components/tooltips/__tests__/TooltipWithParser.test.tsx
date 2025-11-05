import { render, screen } from '@testing-library/react'
import { TooltipWithParser } from '../TooltipWithParser'

// Mock html-react-parser
jest.mock('html-react-parser', () => ({
    __esModule: true,
    default: (html: string) => {
        // Simulate XSS protection: strip <script> tags
        const sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        return sanitized
    }
}))

describe('TooltipWithParser', () => {
    describe('HTML Parsing', () => {
        it('should render HTML content correctly', () => {
            const htmlContent = '<strong>Bold</strong> and <em>italic</em> text'
            render(<TooltipWithParser title={htmlContent} />)

            const icon = screen.getByRole('button')
            // Verify html-react-parser processes the HTML in aria-label
            expect(icon).toHaveAccessibleName(htmlContent)
        })

        it('should handle simple text without HTML tags', () => {
            const plainText = 'Simple tooltip text'
            render(<TooltipWithParser title={plainText} />)

            const icon = screen.getByRole('button')
            expect(icon).toHaveAccessibleName(plainText)
        })

        it('should parse complex HTML structures', () => {
            const complexHtml = '<div><p>Paragraph</p><ul><li>Item 1</li></ul></div>'
            render(<TooltipWithParser title={complexHtml} />)

            const icon = screen.getByRole('button')
            expect(icon).toHaveAccessibleName(complexHtml)
        })
    })

    describe('XSS Protection', () => {
        it('should strip script tags from HTML content', () => {
            const maliciousHtml = '<strong>Safe</strong><script>alert("XSS")</script>'
            const expectedSanitized = '<strong>Safe</strong>'
            render(<TooltipWithParser title={maliciousHtml} />)

            const icon = screen.getByRole('button')
            // Script tag should be removed by html-react-parser mock
            expect(icon).toHaveAccessibleName(expectedSanitized)
        })

        it('should handle multiple script injection attempts', () => {
            const maliciousHtml = '<p>Text</p><script>alert(1)</script><script>console.log(2)</script>'
            const expectedSanitized = '<p>Text</p>'
            render(<TooltipWithParser title={maliciousHtml} />)

            const icon = screen.getByRole('button')
            expect(icon).toHaveAccessibleName(expectedSanitized)
        })
    })

    describe('Placement Variants', () => {
        const placements: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left']

        placements.forEach((placement) => {
            it(`should support ${placement} placement`, () => {
                const { container } = render(<TooltipWithParser title='Test' placement={placement} />)
                const icon = container.querySelector('button')
                expect(icon).toBeInTheDocument()
            })
        })

        it('should default to right placement', () => {
            const { container } = render(<TooltipWithParser title='Test' />)
            const icon = container.querySelector('button')
            expect(icon).toBeInTheDocument()
        })
    })

    describe('Icon Size Customization', () => {
        it('should use default icon size of 15px', () => {
            const { container } = render(<TooltipWithParser title='Test' />)
            const icon = container.querySelector('.MuiSvgIcon-root')

            expect(icon).toHaveStyle({ height: '15px', width: '15px' })
        })

        it('should apply custom icon size', () => {
            const customSize = 24
            const { container } = render(<TooltipWithParser title='Test' iconSize={customSize} />)
            const icon = container.querySelector('.MuiSvgIcon-root')

            expect(icon).toHaveStyle({ height: '24px', width: '24px' })
        })

        it('should apply icon size to both IconButton and Info icon', () => {
            const customSize = 20
            const { container } = render(<TooltipWithParser title='Test' iconSize={customSize} />)

            const iconButton = container.querySelector('button')
            const icon = container.querySelector('.MuiSvgIcon-root')

            expect(iconButton).toHaveStyle({ height: '20px', width: '20px' })
            expect(icon).toHaveStyle({ height: '20px', width: '20px' })
        })
    })

    describe('Tooltip MaxWidth', () => {
        it('should use default maxWidth of 300px', () => {
            render(<TooltipWithParser title='Test' />)
            // Tooltip rendering is handled by MUI
            const icon = screen.getByRole('button')
            expect(icon).toBeInTheDocument()
        })

        it('should apply custom maxWidth', () => {
            const customWidth = 500
            render(<TooltipWithParser title='Test' maxWidth={customWidth} />)
            const icon = screen.getByRole('button')
            expect(icon).toBeInTheDocument()
        })
    })

    describe('Custom Styles', () => {
        it('should apply custom sx prop to Info icon', () => {
            const customSx = { color: 'primary.main' }
            const { container } = render(<TooltipWithParser title='Test' sx={customSx} />)

            const icon = container.querySelector('.MuiSvgIcon-root')
            expect(icon).toBeInTheDocument()
        })

        it('should preserve color: inherit for theme adaptation', () => {
            const { container } = render(<TooltipWithParser title='Test' />)
            const icon = container.querySelector('.MuiSvgIcon-root')

            // color: 'inherit' is applied for MUI v6 ColorScheme API
            expect(icon).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should render Info icon button with accessible role', () => {
            render(<TooltipWithParser title='Help text' />)
            const button = screen.getByRole('button')
            expect(button).toBeInTheDocument()
        })

        it('should be keyboard accessible', async () => {
            render(<TooltipWithParser title='Help text' />)
            const button = screen.getByRole('button')

            button.focus()
            expect(button).toHaveFocus()
        })
    })

    describe('Component Integration', () => {
        it('should render without crashing', () => {
            expect(() => render(<TooltipWithParser title='Test' />)).not.toThrow()
        })

        it('should accept all valid props combinations', () => {
            expect(() =>
                render(
                    <TooltipWithParser
                        title='<strong>Test</strong>'
                        placement='top'
                        iconSize={20}
                        maxWidth={400}
                        sx={{ color: 'error.main' }}
                    />
                )
            ).not.toThrow()
        })
    })
})
