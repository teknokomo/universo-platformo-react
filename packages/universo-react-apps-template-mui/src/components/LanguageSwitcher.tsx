/**
 * Universo Platformo | LanguageSwitcher for Application Runtime
 *
 * Compact language selector with badge showing current language.
 * Uses i18n instance directly — no namespace dependency.
 * Adapted from universo-template-mui/shared/LanguageSwitcher.
 */

import { useState, useEffect, useMemo, type MouseEvent } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import { styled, useTheme } from '@mui/material/styles'
import LanguageIcon from '@mui/icons-material/Language'
import CheckIcon from '@mui/icons-material/Check'
import i18n from '@universo-react/i18n'
import { useTranslation } from 'react-i18next'
import { readRuntimeLocale, restoreRuntimeLocation, updateRuntimeLocale } from '../utils/runtimeLocale'

// Small badge for 2-letter language code overlay
const LangBadge = styled(Badge)(({ theme }) => ({
    '& .MuiBadge-badge': {
        minWidth: 16,
        height: 16,
        padding: 0,
        borderRadius: 8,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: '16px',
        border: `1px solid ${theme.palette.background.paper}`,
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
        color: theme.palette.text.primary
    }
}))

/** Normalize language code (e.g., 'en-US' → 'en') */
const normalizeLang = (code: string) => (code ? String(code).slice(0, 2).toLowerCase() : 'en')

export default function LanguageSwitcher() {
    const theme = useTheme()
    const { t } = useTranslation('header', { i18n })
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [currentLang, setCurrentLang] = useState(() => normalizeLang(readRuntimeLocale() || i18n.resolvedLanguage || i18n.language))
    const open = Boolean(anchorEl)

    useEffect(() => {
        const updateLanguage = () => {
            setCurrentLang(normalizeLang(i18n.resolvedLanguage || i18n.language))
        }

        updateLanguage()
        i18n.on('languageChanged', updateLanguage)

        return () => {
            i18n.off('languageChanged', updateLanguage)
        }
    }, [])

    const labels = {
        tooltip: t('language.tooltip', { defaultValue: 'Language' }),
        menuTitle: t('language.menuTitle', { defaultValue: 'Choose language' })
    }

    const availableLanguages = useMemo(() => {
        const resourceLangs = Object.keys(i18n.options?.resources || { en: {}, ru: {} })
        return Array.from(new Set(resourceLangs))
            .sort()
            .map((code) => ({
                code,
                label: t(`language.${normalizeLang(code)}`, { defaultValue: code.toUpperCase() })
            }))
    }, [t])

    const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
    const handleClose = () => setAnchorEl(null)
    const handleChange = async (code: string) => {
        const normalizedCode = normalizeLang(code)
        const previousHref = updateRuntimeLocale(normalizedCode)
        try {
            await i18n.changeLanguage(normalizedCode)
            setCurrentLang(normalizedCode)
        } catch {
            if (previousHref) restoreRuntimeLocation(previousHref)
            console.error('Language change failed')
        } finally {
            handleClose()
        }
    }

    return (
        <>
            <Tooltip title={labels.tooltip}>
                <span>
                    <LangBadge
                        overlap='rectangular'
                        badgeContent={currentLang.toUpperCase()}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <IconButton
                            onClick={handleOpen}
                            size='small'
                            aria-label={labels.tooltip}
                            aria-haspopup='menu'
                            aria-expanded={open ? 'true' : undefined}
                            sx={{
                                borderRadius: 1,
                                color: theme.palette.text.primary,
                                '&:hover': {
                                    backgroundColor: theme.palette.action.hover
                                }
                            }}
                        >
                            <LanguageIcon />
                        </IconButton>
                    </LangBadge>
                </span>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        variant: 'outlined',
                        elevation: 0,
                        sx: { my: '4px' }
                    }
                }}
            >
                <MenuItem disabled>
                    <ListItemText primary={labels.menuTitle} />
                </MenuItem>
                <Divider />
                {availableLanguages.map((language) => {
                    const selected = currentLang === normalizeLang(language.code)
                    return (
                        <MenuItem key={language.code} onClick={() => handleChange(language.code)} selected={selected}>
                            <ListItemIcon>
                                {selected ? <CheckIcon fontSize='small' /> : <Box sx={{ width: 20, height: 20 }} />}
                            </ListItemIcon>
                            <ListItemText primary={language.label} />
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}
