import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

import { StandardDialog } from '../dialogs/StandardDialog'

export interface ThemePresetManagerItem {
    key: string
    id: string
    codename: string
    label: string
    description?: Record<string, string>
    source: 'file' | 'metahub' | 'application'
    version: number
    archived?: boolean
    usageCount?: number | null
}

export interface ThemePresetManagerDialogProps {
    open: boolean
    onClose: () => void
    testIdPrefix: string
    items: ThemePresetManagerItem[]
    loading?: boolean
    loadError?: boolean
    busy?: boolean
    onCreate: () => void
    onCopy: (item: ThemePresetManagerItem) => void
    onArchive: (item: ThemePresetManagerItem) => void
    onDelete: (item: ThemePresetManagerItem) => void
    onExport: (item: ThemePresetManagerItem) => void
    onRetry: () => void
}

// auto-fill (not auto-fit): keeps preset cards at their natural width and
// packed to the left instead of stretching across half the dialog.
const GRID_TEMPLATE = 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))'

/**
 * Preset library surface (TZ FR-003): card grid listing file + DB presets
 * with source, version, status, and usage; follows the management-surface
 * idiom of the messenger bindings panel (cards, Alert states, localized).
 */
export function ThemePresetManagerDialog({
    open,
    onClose,
    testIdPrefix,
    items,
    loading = false,
    loadError = false,
    busy = false,
    onCreate,
    onCopy,
    onArchive,
    onDelete,
    onExport,
    onRetry
}: ThemePresetManagerDialogProps) {
    const { t } = useTranslation('appearance')

    return (
        <StandardDialog
            open={open}
            onClose={onClose}
            title={t('manager.title')}
            maxWidth='md'
            fullWidth
            actions={
                <>
                    {/* Presentation policy is strict-modal (backdrop/escape are
                        blocked), so an explicit close action is mandatory. */}
                    <Button variant='outlined' onClick={onClose} data-testid={`${testIdPrefix}-close`}>
                        {t('actions.close')}
                    </Button>
                    <Button variant='contained' onClick={onCreate} disabled={busy} data-testid={`${testIdPrefix}-create`}>
                        {t('actions.create')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ alignItems: 'stretch' }} data-testid={`${testIdPrefix}-manager`}>
                {loadError && (
                    <Alert
                        severity='error'
                        action={
                            <Button color='inherit' size='small' onClick={onRetry} data-testid={`${testIdPrefix}-retry`}>
                                {t('manager.retry')}
                            </Button>
                        }
                    >
                        {t('manager.loadError')}
                    </Alert>
                )}

                {loading && (
                    <Stack sx={{ alignItems: 'center', py: 4 }}>
                        <CircularProgress size={28} />
                    </Stack>
                )}

                {!loading && !loadError && items.length === 0 && (
                    <Alert severity='info' data-testid={`${testIdPrefix}-empty`}>
                        {t('manager.empty')}
                    </Alert>
                )}

                {!loading && !loadError && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 2 }}>
                        {items.map((item) => (
                            <Card key={item.key} variant='outlined' data-testid={`${testIdPrefix}-card-${item.codename}`}>
                                <CardContent>
                                    <Stack direction='row' spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                                        <Typography variant='subtitle2' noWrap sx={{ flex: 1 }}>
                                            {item.label}
                                        </Typography>
                                        <Chip size='small' label={t(`preset.${item.source}`)} />
                                        <Chip size='small' label={t('preset.version', { version: item.version })} />
                                        {item.archived && <Chip size='small' color='default' label={t('preset.archived')} />}
                                    </Stack>
                                    {item.description && typeof item.description.en === 'string' && (
                                        <Typography variant='body2' gutterBottom sx={{ color: 'text.secondary' }}>
                                            {item.description.en}
                                        </Typography>
                                    )}
                                    <Typography variant='caption' gutterBottom sx={{ display: 'block', color: 'text.secondary' }}>
                                        {`${t('manager.codename')}: ${item.codename}`}
                                        {typeof item.usageCount === 'number' ? ` · ${t('preset.usage', { count: item.usageCount })}` : ''}
                                    </Typography>
                                    {item.source !== 'file' && (
                                        <Stack direction='row' spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                                            <Button
                                                size='small'
                                                onClick={() => onCopy(item)}
                                                disabled={busy}
                                                data-testid={`${testIdPrefix}-copy-${item.codename}`}
                                                sx={{ whiteSpace: 'nowrap' }}
                                            >
                                                {t('actions.copy')}
                                            </Button>
                                            {!item.archived && (
                                                <Button
                                                    size='small'
                                                    onClick={() => onArchive(item)}
                                                    disabled={busy}
                                                    data-testid={`${testIdPrefix}-archive-${item.codename}`}
                                                    sx={{ whiteSpace: 'nowrap' }}
                                                >
                                                    {t('actions.archive')}
                                                </Button>
                                            )}
                                            <Button
                                                size='small'
                                                onClick={() => onExport(item)}
                                                disabled={busy}
                                                data-testid={`${testIdPrefix}-export-${item.codename}`}
                                                sx={{ whiteSpace: 'nowrap' }}
                                            >
                                                {t('actions.export')}
                                            </Button>
                                            <Button
                                                size='small'
                                                color='error'
                                                onClick={() => onDelete(item)}
                                                disabled={busy || (typeof item.usageCount === 'number' && item.usageCount > 0)}
                                                data-testid={`${testIdPrefix}-delete-${item.codename}`}
                                                sx={{ whiteSpace: 'nowrap' }}
                                            >
                                                {t('actions.delete')}
                                            </Button>
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                )}
            </Stack>
        </StandardDialog>
    )
}
