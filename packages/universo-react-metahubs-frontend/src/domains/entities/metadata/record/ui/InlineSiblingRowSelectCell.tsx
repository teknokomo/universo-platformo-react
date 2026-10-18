import { useMemo } from 'react'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { buildTabularSiblingRowOptions, isSafeTabularSiblingLabel } from '@universo-react/utils'
import type { DynamicFieldConfig } from '@universo-react/template-mui'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'
import { extractInlineTableDisplayString } from './inlineTableEditorValueUtils'

type SiblingTableValues = Record<string, { rows: Record<string, unknown>[]; childFields: DynamicFieldConfig[]; rowOrdering?: unknown }>

type InlineSiblingRowSelectCellProps = {
    field: DynamicFieldConfig
    value: unknown
    siblingTableValues?: SiblingTableValues
    locale: string
    disabled: boolean
    onChange: (value: unknown) => void
}

const buildSiblingRowOptions = (field: DynamicFieldConfig, siblingTableValues: SiblingTableValues | undefined, locale: string) =>
    buildTabularSiblingRowOptions({
        field,
        siblingTables: siblingTableValues,
        formatLabel: (value) => {
            const label = extractInlineTableDisplayString(value, locale).trim()
            return isSafeTabularSiblingLabel(label) ? label : ''
        }
    })

/** Render a safe, localized selector for a row in a sibling TABLE component. */
export function InlineSiblingRowSelectCell({
    field,
    value,
    siblingTableValues,
    locale,
    disabled,
    onChange
}: InlineSiblingRowSelectCellProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const options = useMemo(() => buildSiblingRowOptions(field, siblingTableValues, locale), [field, siblingTableValues, locale])
    const selectedValue = typeof value === 'string' ? value : ''
    const selectedOption = options.find((option) => option.id === selectedValue)
    const unavailable = t('records.table.siblingUnavailable', 'Unavailable option')

    if (disabled) {
        return (
            <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                {selectedOption?.label ?? (selectedValue ? unavailable : '—')}
            </Typography>
        )
    }

    return (
        <Select
            size='small'
            variant='standard'
            disableUnderline
            value={selectedValue}
            onChange={(event) => onChange(event.target.value || null)}
            fullWidth
            displayEmpty
            inputProps={{ 'aria-label': field.label }}
            sx={{
                fontSize: 13,
                minWidth: 0,
                m: 0,
                p: 0,
                '& .MuiSelect-select': { py: 0, pr: '20px !important', pl: 0 }
            }}
        >
            <MenuItem value='' disabled={options.length === 0}>
                {options.length === 0
                    ? t('records.table.siblingNoOptions', 'No options available')
                    : t('records.table.siblingSelectPlaceholder', 'Select an option')}
            </MenuItem>
            {selectedValue && !selectedOption ? (
                <MenuItem value={selectedValue} disabled>
                    {unavailable}
                </MenuItem>
            ) : null}
            {options.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                    {option.label}
                </MenuItem>
            ))}
        </Select>
    )
}
