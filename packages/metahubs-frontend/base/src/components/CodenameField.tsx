import { TextField, TextFieldProps } from '@mui/material'
import { sanitizeCodename } from '../utils/codename'

export interface CodenameFieldProps {
    /** Current codename value */
    value: string
    /** Called when codename changes */
    onChange: (value: string) => void
    /** Whether the user has manually touched/edited the codename */
    touched: boolean
    /** Called when touched state should change */
    onTouchedChange: (touched: boolean) => void
    /** Field label */
    label: string
    /** Helper text shown below the field */
    helperText?: string
    /** Error message (overrides helperText) */
    error?: string
    /** Whether the field is disabled */
    disabled?: boolean
    /** Whether the field is required */
    required?: boolean
    /** Additional TextField props */
    textFieldProps?: Partial<Omit<TextFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'error' | 'disabled' | 'required'>>
}

/**
 * Reusable Codename field with auto-normalization on blur.
 * Use together with useCodenameAutoFill hook for auto-fill from name.
 */
// Props are validated via TypeScript CodenameFieldProps interface
/* eslint-disable react/prop-types */
export const CodenameField: React.FC<CodenameFieldProps> = ({
    value,
    onChange,
    touched,
    onTouchedChange,
    label,
    helperText,
    error,
    disabled = false,
    required = false,
    textFieldProps
}) => {
    /* eslint-enable react/prop-types */
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value)
        if (!touched) {
            onTouchedChange(true)
        }
    }

    const handleBlur = () => {
        const normalized = sanitizeCodename(value)
        if (normalized && normalized !== value) {
            onChange(normalized)
        }
    }

    return (
        <TextField
            label={label}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            fullWidth
            required={required}
            disabled={disabled}
            error={Boolean(error)}
            helperText={error || helperText}
            {...textFieldProps}
        />
    )
}

export default CodenameField
