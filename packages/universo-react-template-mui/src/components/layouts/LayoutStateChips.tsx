import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

export type LayoutChipLabels = {
    active: string
    inactive: string
    default: string
    source?: Partial<Record<'metahub' | 'application', string>>
    syncState?: Partial<Record<string, string>>
}

export interface LayoutStateChipsProps {
    isActive?: boolean
    isDefault?: boolean
    sourceKind?: 'metahub' | 'application' | null
    syncState?: string | null
    labels: LayoutChipLabels
    size?: 'small' | 'medium'
}

const resolveStateColor = (syncState: string | null | undefined): 'default' | 'success' | 'warning' | 'error' => {
    if (syncState === 'conflict') return 'error'
    if (syncState === 'local_modified' || syncState === 'source_updated') return 'warning'
    if (syncState === 'source_removed' || syncState === 'source_excluded') return 'default'
    return 'success'
}

const resolveSourceColor = (sourceKind: 'metahub' | 'application' | null | undefined): 'default' | 'primary' =>
    sourceKind === 'application' ? 'primary' : 'default'

export const LayoutStateChips = ({ isActive, isDefault, sourceKind, syncState, labels, size = 'small' }: LayoutStateChipsProps) => {
    const sourceLabel = sourceKind ? labels.source?.[sourceKind] : null
    const syncStateLabel = syncState ? labels.syncState?.[syncState] : null

    return (
        <Stack direction='row' spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {typeof isActive === 'boolean' ? (
                <Chip
                    size={size}
                    label={isActive ? labels.active : labels.inactive}
                    color={isActive ? 'success' : 'default'}
                    variant='outlined'
                />
            ) : null}
            {isDefault ? (
                <Chip size={size} label={labels.default} color='primary' variant='outlined' icon={<StarRoundedIcon fontSize='small' />} />
            ) : null}
            {sourceLabel ? <Chip size={size} label={sourceLabel} color={resolveSourceColor(sourceKind)} variant='outlined' /> : null}
            {syncStateLabel ? <Chip size={size} label={syncStateLabel} color={resolveStateColor(syncState)} variant='outlined' /> : null}
        </Stack>
    )
}

export default LayoutStateChips
