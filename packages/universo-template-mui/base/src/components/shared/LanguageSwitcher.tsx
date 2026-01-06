import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, Divider, Badge, Box, IconButton } from '@mui/material'
import { styled, useTheme } from '@mui/material/styles'
import LanguageIcon from '@mui/icons-material/Language'
import CheckIcon from '@mui/icons-material/Check'
import i18n, { useTranslation } from '@universo/i18n'

// Small badge style for 2-letter language code overlay
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

// Normalize language code (e.g., 'en-US' -> 'en')
const normalizeLang = (code: string) => (code ? String(code).slice(0, 2).toLowerCase() : 'en')

export default function LanguageSwitcher() {
    const theme = useTheme()
    const { t } = useTranslation('header')
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [currentLang, setCurrentLang] = useState('en')
    const open = Boolean(anchorEl)

    // Update current language when it changes
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
        const codes = Array.from(new Set(resourceLangs)).sort()
        return codes.map((code) => ({
            code,
            label: t(`language.${code}`, { defaultValue: code.toUpperCase() })
        }))
    }, [t])

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
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
            <Tooltip title={t('language.tooltip')}>
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
                        sx: {
                            my: '4px'
                        }
                    }
                }}
            >
                <MenuItem disabled>
                    <ListItemText primary={t('language.menuTitle')} />
                </MenuItem>
                <Divider />
                {availableLanguages.map((l) => {
                    const selected = currentLang === normalizeLang(l.code)
                    return (
                        <MenuItem key={l.code} onClick={() => handleChange(l.code)} selected={selected}>
                            <ListItemIcon>
                                {selected ? <CheckIcon fontSize='small' /> : <Box sx={{ width: 20, height: 20 }} />}
                            </ListItemIcon>
                            <ListItemText primary={l.label} />
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}
