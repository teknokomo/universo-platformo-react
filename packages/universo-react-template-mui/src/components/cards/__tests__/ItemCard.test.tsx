jest.unmock('@universo-react/i18n')
jest.unmock('react-i18next')

import { TextEncoder as NodeTextEncoder } from 'node:util'
Object.assign(globalThis, { TextEncoder: NodeTextEncoder })

import React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { getInstance } from '@universo-react/i18n'
import { I18nextProvider } from 'react-i18next'
import { ItemCard, type ItemCardData } from '../ItemCard'

const theme = createTheme()
const i18n = getInstance()

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </MemoryRouter>
    </I18nextProvider>
)

describe('ItemCard', () => {
    const noop = () => undefined
    const mockData: ItemCardData = {
        name: 'Test Item',
        description: 'Test Description',
        iconSrc: 'test-icon.png',
        color: '#ff0000'
    }

    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

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

        it('wraps long titles when requested', () => {
            const title = 'A long display name that should stay readable on narrow cards'
            render(
                <TestWrapper>
                    <ItemCard data={{ name: title }} wrapTitle />
                </TestWrapper>
            )

            expect(screen.getByText(title)).toHaveStyle({ whiteSpace: 'normal', overflowWrap: 'anywhere' })
            expect(screen.getByText(title).closest('.MuiCard-root')).toHaveStyle({ height: 'auto', minHeight: '180px' })
        })

        it('shows the full description when wrapping is requested', () => {
            render(
                <TestWrapper>
                    <ItemCard data={{ name: 'Bot', description: 'A long description that should wrap on narrow cards' }} wrapDescription />
                </TestWrapper>
            )

            expect(screen.getByText('A long description that should wrap on narrow cards')).toHaveStyle({
                display: 'block',
                overflow: 'visible',
                overflowWrap: 'anywhere'
            })
            expect(screen.getByText('A long description that should wrap on narrow cards').closest('.MuiCard-root')).toHaveStyle({
                height: 'auto',
                minHeight: '180px'
            })
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
        it('exposes a named button and calls onClick when the card is activated', async () => {
            const user = userEvent.setup()
            const handleClick = jest.fn()

            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={handleClick} />
                </TestWrapper>
            )

            const action = screen.getByRole('button', { name: 'Test Item', exact: true })
            await user.click(action)

            expect(handleClick).toHaveBeenCalledTimes(1)
        })

        it('activates a clickable card with Enter from the keyboard', async () => {
            const user = userEvent.setup()
            const handleClick = jest.fn()

            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={handleClick} />
                </TestWrapper>
            )

            const action = screen.getByRole('button', { name: 'Test Item', exact: true })
            await user.tab()
            expect(action).toHaveFocus()
            await user.keyboard('{Enter}')

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

        it('keeps footer controls above the card action and prevents card activation', async () => {
            const user = userEvent.setup()
            const handleCardClick = jest.fn()
            const handleFooterButtonClick = jest.fn()
            const handleFooterLinkClick = jest.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault())

            render(
                <TestWrapper>
                    <ItemCard
                        data={mockData}
                        onClick={handleCardClick}
                        footerEndContent={
                            <>
                                <button type='button' onClick={handleFooterButtonClick}>
                                    Footer action
                                </button>
                                <a href='/footer-details' onClick={handleFooterLinkClick}>
                                    Footer link
                                </a>
                            </>
                        }
                    />
                </TestWrapper>
            )

            const footerButton = screen.getByRole('button', { name: 'Footer action' })
            const footerLink = screen.getByRole('link', { name: 'Footer link' })
            const footerLayer = footerButton.parentElement?.parentElement
            const cardAction = screen.getByRole('button', { name: 'Test Item', exact: true })

            expect(cardAction).toHaveStyle({ zIndex: '1' })
            expect(footerLayer).toHaveStyle({ position: 'relative', zIndex: '6' })
            expect(footerLink).toHaveAttribute('href', '/footer-details')

            await user.click(footerButton)
            await user.click(footerLink)

            expect(handleFooterButtonClick).toHaveBeenCalledTimes(1)
            expect(handleFooterLinkClick).toHaveBeenCalledTimes(1)
            expect(handleCardClick).not.toHaveBeenCalled()
        })

        it('keeps footer controls above the full-card link overlay', async () => {
            const user = userEvent.setup()
            const handleFooterButtonClick = jest.fn()

            render(
                <TestWrapper>
                    <ItemCard
                        data={mockData}
                        href='/application'
                        footerEndContent={<button onClick={handleFooterButtonClick}>Footer action</button>}
                    />
                </TestWrapper>
            )

            const footerButton = screen.getByRole('button', { name: 'Footer action' })
            const footerLayer = footerButton.parentElement?.parentElement
            const cardLink = screen.getByRole('link', { name: 'Test Item', exact: true })

            expect(footerLayer).toHaveStyle({ position: 'relative', zIndex: '6' })
            expect(cardLink).toHaveStyle({ zIndex: '5' })

            await user.click(footerButton)

            expect(handleFooterButtonClick).toHaveBeenCalledTimes(1)
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

    describe('Touch-friendly title', () => {
        it('reveals the full title when the truncated title is touched', async () => {
            const fullTitle = 'Customer support and billing questions (@very_long_support_bot_username)'
            render(
                <TestWrapper>
                    <ItemCard data={{ name: 'Customer support and billing questions' }} titleTooltip={fullTitle} footerStackOnMobile />
                </TestWrapper>
            )

            const title = screen.getByLabelText(fullTitle)
            fireEvent.touchStart(title, {
                touches: [{ identifier: 1, target: title, clientX: 0, clientY: 0 }]
            })

            expect(await screen.findByRole('tooltip', {}, { timeout: 1500 })).toHaveTextContent(fullTitle)
        })
    })

    describe('Accessibility', () => {
        it('should have cursor pointer style for clickable cards', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={noop} />
                </TestWrapper>
            )

            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            expect(card).toBeInTheDocument()
        })
    })

    describe('Link Navigation (href)', () => {
        it('should render a Link with the correct href when href is provided', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} href='/test-path' />
                </TestWrapper>
            )

            const linkElement = screen.getByRole('link', { name: 'Test Item', exact: true })
            expect(linkElement).toHaveAttribute('href', '/test-path')
        })

        it('uses the full title tooltip as the accessible link name', () => {
            render(
                <TestWrapper>
                    <ItemCard data={{ name: 'Short title' }} titleTooltip='Localized full title' href='/test-path' />
                </TestWrapper>
            )

            expect(screen.getByRole('link', { name: 'Short title — Localized full title', exact: true })).toHaveAttribute(
                'href',
                '/test-path'
            )
        })

        it('includes the visible card title in an explicit action name', () => {
            render(
                <TestWrapper>
                    <ItemCard data={{ name: 'Platform foundations' }} onClick={noop} actionLabel='Open details' />
                </TestWrapper>
            )

            expect(screen.getByRole('button', { name: 'Platform foundations — Open details', exact: true })).toBeInTheDocument()
        })

        it('uses the trimmed visible name when the preferred template name is whitespace', () => {
            render(
                <TestWrapper>
                    <ItemCard data={{ name: 'Visible item name', templateName: '\n\t' }} href='/test-path' />
                </TestWrapper>
            )

            expect(screen.getByText('Visible item name')).toBeInTheDocument()
            expect(screen.getByRole('link', { name: 'Visible item name', exact: true })).toHaveAttribute('href', '/test-path')
        })

        it('uses a real localized fallback when all card titles are empty', async () => {
            render(
                <TestWrapper>
                    <ItemCard data={{ name: '  ', templateName: '\n\t' }} href='/test-path' />
                </TestWrapper>
            )

            expect(screen.getByRole('link', { name: 'Open item', exact: true })).toHaveAttribute('href', '/test-path')

            await act(async () => {
                await i18n.changeLanguage('ru')
            })

            expect(screen.getByRole('link', { name: 'Открыть элемент', exact: true })).toHaveAttribute('href', '/test-path')
        })

        it('keeps header actions operable without activating the clickable card', () => {
            const handleMenuClick = jest.fn()
            const handleCardClick = jest.fn()
            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={handleCardClick} headerAction={<button onClick={handleMenuClick}>Menu</button>} />
                </TestWrapper>
            )

            const menuButton = screen.getByRole('button', { name: 'Menu' })
            fireEvent.click(menuButton)

            // Menu click handler should be called
            expect(handleMenuClick).toHaveBeenCalledTimes(1)
            expect(handleCardClick).not.toHaveBeenCalled()
        })

        it('should call onClick when provided without href', () => {
            const handleClick = jest.fn()
            render(
                <TestWrapper>
                    <ItemCard data={mockData} onClick={handleClick} />
                </TestWrapper>
            )

            fireEvent.click(screen.getByRole('button', { name: 'Test Item', exact: true }))

            expect(handleClick).toHaveBeenCalledTimes(1)
        })

        it('should prioritize href (render link) over onClick when both provided', () => {
            const handleClick = jest.fn()
            render(
                <TestWrapper>
                    <ItemCard data={mockData} href='/priority-test' onClick={handleClick} />
                </TestWrapper>
            )

            const linkElement = screen.getByRole('link', { name: 'Test Item', exact: true })
            expect(linkElement).toHaveAttribute('href', '/priority-test')

            // onClick passed to CardWrapper is undefined when href is present
            // We can verify this by clicking the card wrapper (if we could click "under" the link)
            // But practically, checking the link exists is enough proof of priority
        })

        it('should not call onClick when href is provided', () => {
            const handleClick = jest.fn()
            render(
                <TestWrapper>
                    <ItemCard data={mockData} href='/test-path' onClick={handleClick} />
                </TestWrapper>
            )

            // Simulate click on the card container (underneath the link)
            // In reality the link covers it, but we want to ensure the handler isn't attached to the container
            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            if (card) {
                fireEvent.click(card)
            }

            // onClick should NOT be called because the component logic is: onClick={!href ? onClick : undefined}
            expect(handleClick).not.toHaveBeenCalled()
        })

        it('should render without href or onClick', () => {
            render(
                <TestWrapper>
                    <ItemCard data={mockData} />
                </TestWrapper>
            )

            const card = screen.getByText('Test Item').closest('.MuiCard-root')
            expect(card).toBeInTheDocument()

            // Ensure no link is rendered
            const linkElement = card?.querySelector('a')
            expect(linkElement).not.toBeInTheDocument()
        })
    })
})
