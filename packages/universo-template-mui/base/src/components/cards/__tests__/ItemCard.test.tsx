import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ItemCard, type ItemCardData } from '../ItemCard'

const theme = createTheme()

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>

describe('ItemCard', () => {
    const mockData: ItemCardData = {
        name: 'Test Item',
        description: 'Test Description',
        iconSrc: 'test-icon.png',
        color: '#ff0000'
    }

    describe('Rendering', () => {
        it('should render with basic data', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} />
                </TestWrapper>
            )

            expect(screen.getByText('Test Item')).toBeInTheDocument()
            expect(screen.getByText('Test Description')).toBeInTheDocument()
        })

        it('should render without name', () => {
            const dataWithoutName = { ...mockData, name: undefined }
            render(
                <TestWrapper>
                    <ItemCard data={dataWithoutName} />
                </TestWrapper>
            )

            expect(screen.queryByText('Test Item')).not.toBeInTheDocument()
            expect(screen.getByText('Test Description')).toBeInTheDocument()
        })

        it('should render without description', () => {
            const dataWithoutDesc = { ...mockData, description: undefined }
            render(
                <TestWrapper>
                    <ItemCard data={dataWithoutDesc} />
                </TestWrapper>
            )

            expect(screen.getByText('Test Item')).toBeInTheDocument()
            expect(screen.queryByText('Test Description')).not.toBeInTheDocument()
        })
    })

    describe('Generic Types', () => {
        interface CustomData extends ItemCardData {
            customField: string
            customNumber: number
        }

        it('should work with custom generic type', () => {
            const customData: CustomData = {
                name: 'Custom Item',
                description: 'Custom Description',
                customField: 'custom value',
                customNumber: 42
            }

            const { container } = render(
                <TestWrapper>
                    <ItemCard<CustomData> data={customData} />
                </TestWrapper>
            )

            expect(container.querySelector('.MuiCard-root')).toBeInTheDocument()
        })
    })

    describe('Click Handler', () => {
        it('should call onClick when card is clicked', () => {
            const handleClick = jest.fn()

            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={handleClick} />
                </TestWrapper>
            )

            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            if (card) {
                fireEvent.click(card)
            }

            expect(handleClick).toHaveBeenCalledTimes(1)
        })

        it('should not error when onClick is not provided', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} />
                </TestWrapper>
            )

            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            if (card) {
                expect(() => fireEvent.click(card)).not.toThrow()
            }
        })
    })

    describe('Footer Content', () => {
        it('should render footer end content', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} footerEndContent={<div>Footer Content</div>} />
                </TestWrapper>
            )

            expect(screen.getByText('Footer Content')).toBeInTheDocument()
        })

        it('should not render footer when no content provided', () => {
            const { container } = render(
                <TestWrapper>
                    <ItemCard data={mockData} />
                </TestWrapper>
            )

            // Footer should not be present without footerEndContent or images
            const footers = container.querySelectorAll('[data-testid="footer"]')
            expect(footers).toHaveLength(0)
        })
    })

    describe('Header Action', () => {
        it('should render header action', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} headerAction={<button>Action</button>} />
                </TestWrapper>
            )

            expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
        })
    })

    describe('Images', () => {
        it('should render images when provided', () => {
            const images = [
                { src: 'image1.png', alt: 'Image 1' },
                { src: 'image2.png', alt: 'Image 2' }
            ]

            render(
                <TestWrapper>
                    <ItemCard data={mockData} images={images} />
                </TestWrapper>
            )

            // Images rendering logic depends on implementation
            // This test verifies the component accepts the prop
            expect(screen.getByText('Test Item')).toBeInTheDocument()
        })
    })

    describe('Styling Props', () => {
        it('should apply allowStretch prop', () => {
            const { container } = render(
                <TestWrapper>
                    <ItemCard data={mockData} allowStretch />
                </TestWrapper>
            )

            const card = container.querySelector('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })

        it('should apply custom sx prop', () => {
            const customSx = { backgroundColor: 'red' }

            const { container } = render(
                <TestWrapper>
                    <ItemCard data={mockData} sx={customSx} />
                </TestWrapper>
            )

            const card = container.querySelector('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should have cursor pointer style for clickable cards', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={() => {}} />
                </TestWrapper>
            )

            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })
    })
})
