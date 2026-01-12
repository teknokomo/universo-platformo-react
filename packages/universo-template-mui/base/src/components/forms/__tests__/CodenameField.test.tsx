import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodenameField, CodenameFieldProps } from '../CodenameField'

// Mock sanitizeCodename
jest.mock('@universo/utils/validation/codename', () => ({
    sanitizeCodename: (value: string) =>
        value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
}))

describe('CodenameField', () => {
    const defaultProps: CodenameFieldProps = {
        value: '',
        onChange: jest.fn(),
        touched: false,
        onTouchedChange: jest.fn(),
        label: 'Codename'
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should render with label', () => {
        render(<CodenameField {...defaultProps} />)
        expect(screen.getByLabelText('Codename')).toBeInTheDocument()
    })

    it('should display current value', () => {
        render(<CodenameField {...defaultProps} value='test-codename' />)
        expect(screen.getByDisplayValue('test-codename')).toBeInTheDocument()
    })

    it('should call onChange when value changes', async () => {
        const onChange = jest.fn()
        render(<CodenameField {...defaultProps} onChange={onChange} />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'new-value')

        expect(onChange).toHaveBeenCalled()
    })

    it('should mark as touched on first change', async () => {
        const onTouchedChange = jest.fn()
        render(<CodenameField {...defaultProps} onTouchedChange={onTouchedChange} />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'a')

        expect(onTouchedChange).toHaveBeenCalledWith(true)
    })

    it('should not call onTouchedChange if already touched', async () => {
        const onTouchedChange = jest.fn()
        render(<CodenameField {...defaultProps} touched={true} onTouchedChange={onTouchedChange} />)

        const input = screen.getByLabelText('Codename')
        await userEvent.type(input, 'a')

        expect(onTouchedChange).not.toHaveBeenCalled()
    })

    it('should normalize value on blur', () => {
        const onChange = jest.fn()
        render(<CodenameField {...defaultProps} value='Test Value' onChange={onChange} />)

        const input = screen.getByLabelText('Codename')
        fireEvent.blur(input)

        // sanitizeCodename mock will transform "Test Value" to "test-value"
        expect(onChange).toHaveBeenCalledWith('test-value')
    })

    it('should not call onChange on blur if value unchanged', () => {
        const onChange = jest.fn()
        render(<CodenameField {...defaultProps} value='test-value' onChange={onChange} />)

        const input = screen.getByLabelText('Codename')
        fireEvent.blur(input)

        // Already normalized, no change needed
        expect(onChange).not.toHaveBeenCalled()
    })

    it('should display helper text', () => {
        render(<CodenameField {...defaultProps} helperText='Enter a unique codename' />)
        expect(screen.getByText('Enter a unique codename')).toBeInTheDocument()
    })

    it('should display error message and hide helper text', () => {
        render(<CodenameField {...defaultProps} helperText='Helper' error='This codename is taken' />)
        expect(screen.getByText('This codename is taken')).toBeInTheDocument()
        expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })

    it('should be disabled when disabled prop is true', () => {
        render(<CodenameField {...defaultProps} disabled={true} />)
        expect(screen.getByLabelText('Codename')).toBeDisabled()
    })

    it('should show required indicator when required prop is true', () => {
        render(<CodenameField {...defaultProps} required={true} />)
        // MUI adds * to required fields
        expect(screen.getByLabelText('Codename *')).toBeInTheDocument()
    })

    it('should apply additional TextField props', () => {
        render(<CodenameField {...defaultProps} textFieldProps={{ placeholder: 'Enter codename' }} />)
        expect(screen.getByPlaceholderText('Enter codename')).toBeInTheDocument()
    })

    it('should have fullWidth by default', () => {
        render(<CodenameField {...defaultProps} />)
        const input = screen.getByLabelText('Codename')
        // Check that MuiFormControl has fullWidth class
        expect(input.closest('.MuiFormControl-root')).toHaveClass('MuiFormControl-fullWidth')
    })
})
