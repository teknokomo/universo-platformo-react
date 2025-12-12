import React from 'react'
import { Chip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import type { BaseRole, GlobalRole, RoleMetadata, VersionedLocalizedContent } from '@universo/types'
import { isSupportedLocale } from '@universo/types'
import { resolveVlcContent } from '@universo/utils'

// Access type indicates how user obtained access to the entity
// 'member' = direct membership, other strings = global role name
export type AccessType = 'member' | string

export interface RoleChipProps {
    role: BaseRole | GlobalRole | string
    // accessType indicates how access was obtained; if not 'member', show that role instead
    accessType?: AccessType
    // Optional role metadata for dynamic colors (from AbilityContext.rolesMetadata)
    roleMetadata?: RoleMetadata
    size?: 'small' | 'medium'
    variant?: 'filled' | 'outlined'
    className?: string
}

// Fallback color styles for known roles (used when roleMetadata is not provided)
const ROLE_STYLE_MAP: Record<string, { bgcolor: string; color: string; borderColor: string }> = {
    // Global roles (platform-wide)
    superadmin: {
        bgcolor: '#fce4ec',
        color: '#ad1457',
        borderColor: '#f06292'
    },
    supermoderator: {
        bgcolor: '#fff3e0',
        color: '#e65100',
        borderColor: '#ffb74d'
    },
    // Entity roles (per-resource)
    owner: {
        bgcolor: '#ffebee',
        color: '#c62828',
        borderColor: '#e57373'
    },
    admin: {
        bgcolor: '#f3e5f5',
        color: '#7b1fa2',
        borderColor: '#ba68c8'
    },
    editor: {
        bgcolor: '#e3f2fd',
        color: '#1976d2',
        borderColor: '#64b5f6'
    },
    member: {
        bgcolor: '#f5f5f5',
        color: '#616161',
        borderColor: '#9e9e9e'
    }
}

// Fallback style for unknown roles
const FALLBACK_STYLE = {
    bgcolor: '#f5f5f5',
    color: '#616161',
    borderColor: '#9e9e9e'
}

/**
 * Generate styles from metadata color (hex code like '#ad1457')
 * Creates a light background and uses the color for text/border
 */
function stylesFromMetadata(metadata: RoleMetadata): { bgcolor: string; color: string; borderColor: string } {
    const color = metadata.color || '#616161'
    // Create light background by adding transparency or using a lighter version
    // For simplicity, use alpha channel for light background
    return {
        bgcolor: `${color}15`, // 15% opacity background
        color: color,
        borderColor: `${color}80` // 50% opacity border
    }
}

/**
 * Get display name from metadata based on current language
 * Uses VLC resolution with safe fallback
 */
function getRoleName(
    nameVlc: VersionedLocalizedContent<string> | undefined,
    roleCodename: string,
    t: (key: string) => string,
    currentLanguage: string
): string {
    if (!nameVlc) {
        return t(roleCodename)
    }

    // Use type guard for safe locale validation
    const locale = isSupportedLocale(currentLanguage) ? currentLanguage : 'en'
    const resolved = resolveVlcContent(nameVlc, locale, '')
    if (resolved) return resolved

    // Fall back to translation
    return t(roleCodename)
}

export const RoleChip: React.FC<RoleChipProps> = ({ role, accessType, roleMetadata, size = 'small', variant = 'filled', className }) => {
    const { t, i18n: i18nInstance } = useTranslation('roles', { i18n })
    const currentLanguage = i18nInstance.language?.split('-')[0] || 'en'

    // Determine which role to display:
    // If accessType is not 'member', show that instead of entity role
    const displayRole = accessType && accessType !== 'member' ? accessType : role

    // Get styles: prefer metadata if provided, else use static map
    const styles = roleMetadata ? stylesFromMetadata(roleMetadata) : ROLE_STYLE_MAP[displayRole] || FALLBACK_STYLE

    // Get label: prefer metadata name if provided
    // Use roleMetadata.codename if available, else fall back to displayRole
    const roleCodename = roleMetadata?.codename || displayRole
    const label = roleMetadata ? getRoleName(roleMetadata.name, roleCodename, t, currentLanguage) : t(displayRole)

    return (
        <Chip
            label={label}
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
