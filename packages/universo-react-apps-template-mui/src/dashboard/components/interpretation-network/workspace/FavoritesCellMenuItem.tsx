import MenuItem from '@mui/material/MenuItem'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import type { TFunction } from 'i18next'

export interface FavoritesCellMenuItemProps {
    t: TFunction<'interpretationNetwork'>
    isFavorite: boolean
    disabled: boolean
    pending: boolean
    onClick: () => void
}

export function FavoritesCellMenuItem({ t, isFavorite, disabled, pending, onClick }: FavoritesCellMenuItemProps) {
    return (
        <MenuItem disabled={disabled || pending} onClick={onClick}>
            {isFavorite ? <StarRoundedIcon fontSize='small' sx={{ mr: 1 }} /> : <StarBorderRoundedIcon fontSize='small' sx={{ mr: 1 }} />}
            {pending
                ? t('workspace.favorites.updating', 'Updating favorites...')
                : isFavorite
                ? t('workspace.favorites.removeFromCellMenu', 'Remove from favorites')
                : t('workspace.favorites.addFromCellMenu', 'Add to favorites')}
        </MenuItem>
    )
}
