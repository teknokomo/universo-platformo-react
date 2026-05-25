import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MainCard } from '../MainCard'

const theme = createTheme()

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>

describe('MainCard', () => {
    describe('Basic Rendering', () => {
        it('should render children', () => {
            render(
                <TestWrapper>
                    <MainCard>
                        <div>Test Content</div>
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Test Content')).toBeInTheDocument()
        })

        it('should render with title', () => {
            render(
                <TestWrapper>
                    <MainCard title='Test Title'>
                        <div>Content</div>
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Test Title')).toBeInTheDocument()
        })

        it('should render with string title', () => {
            render(
                <TestWrapper>
                    <MainCard title='Simple Title'>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Simple Title')).toBeInTheDocument()
        })

        it('should render with ReactNode title', () => {
            render(
                <TestWrapper>
                    <MainCard title={<span data-testid='custom-title'>Custom Title</span>}>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByTestId('custom-title')).toBeInTheDocument()
        })
    })

    describe('Header', () => {
        it('should render header with title', () => {
            render(
                <TestWrapper>
                    <MainCard title='Header Title'>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Header Title')).toBeInTheDocument()
        })

        it('should render secondary action', () => {
            render(
                <TestWrapper>
                    <MainCard title='Title' secondary={<button>Action</button>}>
                        Content
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
        })

        it('should render dark title variant', () => {
            render(
                <TestWrapper>
                    <MainCard title='Dark Title' darkTitle>
                        Content
                    </MainCard>
                </TestWrapper>
            )

            // Dark title should be wrapped in Typography variant="h3"
            expect(screen.getByText('Dark Title')).toBeInTheDocument()
        })

        it('should not render header when disableHeader is true', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard title='Hidden Title' disableHeader>
                        Content
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument()
            expect(container.querySelector('.MuiCardHeader-root')).not.toBeInTheDocument()
        })
    })

    describe('Content', () => {
        it('should render content by default', () => {
            render(
                <TestWrapper>
                    <MainCard>
                        <div>Default Content</div>
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Default Content')).toBeInTheDocument()
        })

        it('should not wrap content in CardContent when content=false', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard content={false}>
                        <div>Raw Content</div>
                    </MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Raw Content')).toBeInTheDocument()
            expect(container.querySelector('.MuiCardContent-root')).not.toBeInTheDocument()
        })

        it('should apply contentClass', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard contentClass='custom-content-class'>Content</MainCard>
                </TestWrapper>
            )

            const contentElement = container.querySelector('.custom-content-class')
            expect(contentElement).toBeInTheDocument()
        })

        it('should apply contentSX styles', () => {
            const customContentSX = { padding: 4 }

            render(
                <TestWrapper>
                    <MainCard contentSX={customContentSX}>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Content')).toBeInTheDocument()
        })

        it('should disable content padding when disableContentPadding is true', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard disableContentPadding>Content</MainCard>
                </TestWrapper>
            )

            const content = container.querySelector('.MuiCardContent-root')
            expect(content).toBeInTheDocument()
        })
    })

    describe('Styling Props', () => {
        it('should apply border by default', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard>Content</MainCard>
                </TestWrapper>
            )

            const card = container.querySelector('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })

        it('should remove border when border=false', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard border={false}>Content</MainCard>
                </TestWrapper>
            )

            const card = container.querySelector('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })

        it('should apply boxShadow on hover when boxShadow=true', () => {
            render(
                <TestWrapper>
                    <MainCard boxShadow>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Content')).toBeInTheDocument()
        })

        it('should apply custom shadow', () => {
            render(
                <TestWrapper>
                    <MainCard shadow='0 4px 8px rgba(0,0,0,0.1)'>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Content')).toBeInTheDocument()
        })

        it('should remove shadow when shadow=false', () => {
            render(
                <TestWrapper>
                    <MainCard shadow={false}>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Content')).toBeInTheDocument()
        })

        it('should apply custom sx prop', () => {
            const customSx = { backgroundColor: 'primary.main' }

            render(
                <TestWrapper>
                    <MainCard sx={customSx}>Content</MainCard>
                </TestWrapper>
            )

            expect(screen.getByText('Content')).toBeInTheDocument()
        })
    })

    describe('ForwardRef', () => {
        it('should forward ref to Card element', () => {
            const ref = React.createRef<HTMLDivElement>()

            render(
                <TestWrapper>
                    <MainCard ref={ref}>Content</MainCard>
                </TestWrapper>
            )

            expect(ref.current).toBeInstanceOf(HTMLDivElement)
            expect(ref.current?.classList.contains('MuiCard-root')).toBe(true)
        })
    })

    describe('Divider', () => {
        it('should render divider between header and content when title is present', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard title='Title'>Content</MainCard>
                </TestWrapper>
            )

            const divider = container.querySelector('.MuiDivider-root')
            expect(divider).toBeInTheDocument()
        })

        it('should not render divider when title is not present', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard>Content</MainCard>
                </TestWrapper>
            )

            const divider = container.querySelector('.MuiDivider-root')
            expect(divider).not.toBeInTheDocument()
        })

        it('should not render divider when disableHeader is true', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard title='Title' disableHeader>
                        Content
                    </MainCard>
                </TestWrapper>
            )

            const divider = container.querySelector('.MuiDivider-root')
            expect(divider).not.toBeInTheDocument()
        })
    })

    describe('Additional Props', () => {
        it('should pass through other Card props', () => {
            const { container } = render(
                <TestWrapper>
                    <MainCard elevation={8} data-testid='main-card'>
                        Content
                    </MainCard>
                </TestWrapper>
            )

            const card = container.querySelector('[data-testid="main-card"]')
            expect(card).toBeInTheDocument()
        })
    })
})
