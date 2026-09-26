import { useColorScheme } from '@mui/material/styles'
import MenuItem from '@mui/material/MenuItem'
import { SelectProps } from '@mui/material/Select'
import { DropdownSelect as Select } from '../dropdowns'

const selectDisplayProps = {
    'data-screenshot': 'toggle-mode'
} as SelectProps['SelectDisplayProps']

export default function ColorModeSelect(props: Omit<SelectProps, 'ref'>) {
    const { mode, setMode } = useColorScheme()
    if (!mode) {
        return null
    }
    return (
        <Select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'system' | 'light' | 'dark')}
            SelectDisplayProps={selectDisplayProps}
            {...props}
        >
            <MenuItem value='system'>System</MenuItem>
            <MenuItem value='light'>Light</MenuItem>
            <MenuItem value='dark'>Dark</MenuItem>
        </Select>
    )
}
