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
import i18n from '@universo/i18n'

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

/** Static labels — no i18n namespace needed */
const LABELS: Record<string, Record<string, string>> = {
    en: { tooltip: 'Select language', menuTitle: 'Select language', en: 'English', ru: 'Русский' },
    ru: { tooltip: 'Выберите язык', menuTitle: 'Выберите язык', en: 'Английский', ru: 'Русский' }
}

/** Normalize language code (e.g., 'en-US' → 'en') */
const normalizeLang = (code: string) => (code ? String(code).slice(0, 2).toLowerCase() : 'en')

export default function LanguageSwitcher() {
    const theme = useTheme()
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [currentLang, setCurrentLang] = useState('en')
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

    const availableLanguages = useMemo(() => {
        const resourceLangs = Object.keys(i18n.options?.resources || { en: {}, ru: {} })
        return Array.from(new Set(resourceLangs)).sort()
    }, [])

    const labels = LABELS[currentLang] ?? LABELS.en

    const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
    const handleClose = () => setAnchorEl(null)
    const handleChange = async (code: string) => {
        try {
            await i18n.changeLanguage(code)
            setCurrentLang(normalizeLang(code))
        } catch (err) {
            console.error('Language change failed:', err)
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
                {availableLanguages.map((code) => {
                    const selected = currentLang === normalizeLang(code)
                    return (
                        <MenuItem key={code} onClick={() => handleChange(code)} selected={selected}>
                            <ListItemIcon>
                                {selected ? <CheckIcon fontSize='small' /> : <Box sx={{ width: 20, height: 20 }} />}
                            </ListItemIcon>
                            <ListItemText primary={labels[code] ?? code.toUpperCase()} />
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}
