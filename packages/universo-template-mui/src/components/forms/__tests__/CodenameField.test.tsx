import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CodenameField, CodenameFieldProps } from '../CodenameField'
import { createCodenameVLC } from '@universo/utils'

jest.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

// Mock sanitizeCodename
jest.mock('@universo/utils/validation/codename', () => ({
    sanitizeCodename: (value: string) =>
        value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
}))

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('CodenameField', () => {
    const defaultProps: CodenameFieldProps = {
        value: createCodenameVLC('en', ''),
        onChange: jest.fn(),
        touched: false,
        onTouchedChange: jest.fn(),
        label: 'Codename'
    }

    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                locales: [
                    { code: 'en', label: 'English', isDefault: true },
                    { code: 'ru', label: 'Русский', isDefault: false }
                ],
                defaultLocale: 'en'
            })
        }) as jest.Mock
    })

    it('should render with label', () => {
        renderWithProviders(<CodenameField {...defaultProps} />)
        expect(screen.getByLabelText('Codename')).toBeInTheDocument()
    })

    it('should display current value', () => {
        renderWithProviders(<CodenameField {...defaultProps} value={createCodenameVLC('en', 'test-codename')} />)
        expect(screen.getByDisplayValue('test-codename')).toBeInTheDocument()
    })

    it('should call onChange when value changes', async () => {
        const onChange = jest.fn()

        const ControlledField = () => {
            const [value, setValue] = React.useState(createCodenameVLC('en', ''))

            return (
                <CodenameField
                    {...defaultProps}
                    value={value}
                    onChange={(nextValue) => {
                        setValue(nextValue ?? createCodenameVLC('en', ''))
                        onChange(nextValue)
                    }}
                />
            )
        }

        renderWithProviders(<ControlledField />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'new-value')

        expect(onChange).toHaveBeenCalled()
        expect(onChange.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'new-value' })
                })
            })
        )
    })

    it('should mark as touched on first change', async () => {
        const onTouchedChange = jest.fn()
        renderWithProviders(<CodenameField {...defaultProps} onTouchedChange={onTouchedChange} />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'a')

        expect(onTouchedChange).toHaveBeenCalledWith(true)
    })

    it('should not call onTouchedChange if already touched', async () => {
        const onTouchedChange = jest.fn()
        renderWithProviders(<CodenameField {...defaultProps} touched={true} onTouchedChange={onTouchedChange} />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'a')

        expect(onTouchedChange).not.toHaveBeenCalled()
    })

    it('should normalize value on blur', () => {
        const onChange = jest.fn()
        renderWithProviders(<CodenameField {...defaultProps} value={createCodenameVLC('en', 'Test Value')} onChange={onChange} />)

        const input = screen.getByLabelText('Codename')
        fireEvent.blur(input)

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'test-value' })
                })
            })
        )
    })

    it('should not call onChange on blur if value unchanged', () => {
        const onChange = jest.fn()
        renderWithProviders(<CodenameField {...defaultProps} value={createCodenameVLC('en', 'test-value')} onChange={onChange} />)

        const input = screen.getByLabelText('Codename')
        fireEvent.blur(input)

        expect(onChange).not.toHaveBeenCalled()
    })

    it('should use custom normalizeOnBlur when provided', () => {
        const onChange = jest.fn()
        const normalizeOnBlur = jest.fn((input: string) => input.replace(/\s+/g, ''))

        renderWithProviders(
            <CodenameField {...defaultProps} value={createCodenameVLC('en', 'A B')} onChange={onChange} normalizeOnBlur={normalizeOnBlur} />
        )

        const input = screen.getByLabelText('Codename')
        fireEvent.blur(input)

        expect(normalizeOnBlur).toHaveBeenCalledWith('A B')
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'AB' })
                })
            })
        )
    })

    it('should display helper text', () => {
        renderWithProviders(<CodenameField {...defaultProps} helperText='Enter a unique codename' />)
        expect(screen.getByText('Enter a unique codename')).toBeInTheDocument()
    })

    it('should display error message and hide helper text', () => {
        renderWithProviders(<CodenameField {...defaultProps} helperText='Helper' error='This codename is taken' />)
        expect(screen.getByText('This codename is taken')).toBeInTheDocument()
        expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })

    it('should be disabled when disabled prop is true', () => {
        renderWithProviders(<CodenameField {...defaultProps} disabled={true} />)
        expect(screen.getByLabelText('Codename')).toBeDisabled()
    })

    it('should show required indicator when required prop is true', () => {
        renderWithProviders(<CodenameField {...defaultProps} required={true} />)
        expect(screen.getByLabelText('Codename *')).toBeInTheDocument()
    })

    it('should render locale controls for localized codename editing', () => {
        renderWithProviders(<CodenameField {...defaultProps} />)
        expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
    })

    it('should have fullWidth by default', () => {
        renderWithProviders(<CodenameField {...defaultProps} />)
        const input = screen.getByLabelText('Codename')
        expect(input.closest('.MuiFormControl-root')).toHaveClass('MuiFormControl-fullWidth')
    })
})
