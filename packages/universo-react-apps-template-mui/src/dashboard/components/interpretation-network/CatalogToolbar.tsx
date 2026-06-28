import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded'
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded'

export type CatalogViewMode = 'table' | 'cards'

export interface CatalogToolbarProps {
    title: string
    filterLabel: string
    filterValue: string
    viewMode: CatalogViewMode
    viewModeLabel: string
    tableViewLabel: string
    cardViewLabel: string
    createLabel: string
    createDisabled?: boolean
    onFilterChange: (value: string) => void
    onViewModeChange: (mode: CatalogViewMode) => void
    onCreate: () => void
}

export function CatalogToolbar({
    title,
    filterLabel,
    filterValue,
    viewMode,
    viewModeLabel,
    tableViewLabel,
    cardViewLabel,
    createLabel,
    createDisabled = false,
    onFilterChange,
    onViewModeChange,
    onCreate
}: CatalogToolbarProps) {
    return (
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography component='h2' variant='subtitle1' sx={{ fontWeight: 700 }}>
                {title}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ minWidth: 0 }}>
                <TextField
                    size='small'
                    fullWidth
                    value={filterValue}
                    onChange={(event) => onFilterChange(event.target.value)}
                    label={filterLabel}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position='start'>
                                <SearchRoundedIcon fontSize='small' />
                            </InputAdornment>
                        )
                    }}
                />
                <ToggleButtonGroup
                    exclusive
                    size='small'
                    value={viewMode}
                    onChange={(_, next: CatalogViewMode | null) => {
                        if (next) onViewModeChange(next)
                    }}
                    aria-label={viewModeLabel}
                    sx={{
                        height: 40,
                        flexShrink: 0,
                        '& .MuiToggleButton-root': {
                            width: 40,
                            minWidth: 40,
                            height: 40,
                            p: 0
                        }
                    }}
                >
                    <ToggleButton value='table' aria-label={tableViewLabel}>
                        <Tooltip title={tableViewLabel}>
                            <TableRowsRoundedIcon fontSize='small' />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value='cards' aria-label={cardViewLabel}>
                        <Tooltip title={cardViewLabel}>
                            <ViewModuleRoundedIcon fontSize='small' />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
                <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />
                <Button
                    type='button'
                    size='small'
                    variant='contained'
                    startIcon={<AddRoundedIcon />}
                    disabled={createDisabled}
                    onClick={onCreate}
                    sx={{ height: 40, minHeight: 40, flexShrink: 0 }}
                >
                    {createLabel}
                </Button>
            </Stack>
        </Stack>
    )
}
