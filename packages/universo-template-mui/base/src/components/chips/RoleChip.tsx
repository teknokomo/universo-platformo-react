import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import type { BaseRole } from '@universo/types'

export interface RoleChipProps {
    role: BaseRole
    size?: 'small' | 'medium'
    variant?: 'filled' | 'outlined'
    className?: string
}

const ROLE_COLOR_MAP: Record<BaseRole, ChipProps['color']> = {
    owner: 'error',
    admin: 'warning',
    editor: 'info',
    member: 'default'
}

export const RoleChip: React.FC<RoleChipProps> = ({ role, size = 'small', variant = 'filled', className }) => {
    const { t } = useTranslation('roles', { i18n })

    return <Chip label={t(role)} color={ROLE_COLOR_MAP[role]} size={size} variant={variant} className={className} />
}
