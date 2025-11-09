import React from 'react'
import { Chip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import type { BaseRole } from '@universo/types'

export interface RoleChipProps {
    role: BaseRole
    size?: 'small' | 'medium'
    variant?: 'filled' | 'outlined'
    className?: string
}

// Custom color styles for roles with soft backgrounds and darker text for readability
const ROLE_STYLE_MAP: Record<BaseRole, { bgcolor: string; color: string; borderColor: string }> = {
    owner: {
        bgcolor: '#ffebee', // light red background
        color: '#c62828', // dark red text
        borderColor: '#e57373' // soft red border
    },
    admin: {
        bgcolor: '#f3e5f5', // light purple background
        color: '#7b1fa2', // dark purple text
        borderColor: '#ba68c8' // soft purple border
    },
    editor: {
        bgcolor: '#e3f2fd', // light blue background
        color: '#1976d2', // dark blue text
        borderColor: '#64b5f6' // soft blue border
    },
    member: {
        bgcolor: '#f5f5f5', // light grey background
        color: '#616161', // dark grey text
        borderColor: '#9e9e9e' // grey border
    }
}

export const RoleChip: React.FC<RoleChipProps> = ({ role, size = 'small', variant = 'filled', className }) => {
    const { t } = useTranslation('roles', { i18n })
    const styles = ROLE_STYLE_MAP[role]

    return (
        <Chip
            label={t(role)}
            size={size}
            variant={variant}
            className={className}
            sx={{
                bgcolor: styles.bgcolor,
                color: `${styles.color} !important`,
                borderColor: styles.borderColor,
                '& .MuiChip-label': {
                    color: `${styles.color} !important`
                },
                '&.MuiChip-outlined': {
                    borderColor: styles.borderColor
                }
            }}
        />
    )
}
