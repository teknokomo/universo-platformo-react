import { useMemo, useState } from 'react'
import { Avatar, ButtonBase, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, Divider, Badge, Box } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useTheme } from '@mui/material/styles'
import { IconLanguage, IconCheck } from '@tabler/icons-react'
import { useTranslation } from '@universo/i18n'
import i18n from '@universo/i18n'

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
const normalizeLang = (code) => (code ? String(code).slice(0, 2).toLowerCase() : 'en')

const LanguageSwitcher = () => {
    const theme = useTheme()
    const { t } = useTranslation()
    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)

    // Determine current language in a normalized form
    const currentLang = normalizeLang(i18n.resolvedLanguage || i18n.language)

    // Build language list from available resources to support future languages
    const languageItems = useMemo(() => {
        const resourceLangs = Object.keys(i18n.options?.resources || { en: {}, ru: {} })
        // Deduplicate and sort for stable order
        const codes = Array.from(new Set(resourceLangs)).sort()
        return codes.map((code) => ({
            code,
            // Use translated label if exists, fallback to uppercased code
            label: t(`header.language.${code}`, { defaultValue: code.toUpperCase() })
        }))
    }, [t])

    const handleOpen = (e) => setAnchorEl(e.currentTarget)
    const handleClose = () => setAnchorEl(null)
    const handleChange = async (code) => {
        try {
            await i18n.changeLanguage(code)
        } catch (err) {
            // Non-blocking error logging
            console.error('Language change failed:', err)
        } finally {
            handleClose()
        }
    }

    return (
        <>
            <Tooltip title={t('header.language.tooltip')}>
                <span>
                    <LangBadge
                        overlap='rectangular'
                        badgeContent={currentLang.toUpperCase()}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <ButtonBase sx={{ borderRadius: '12px', overflow: 'hidden' }} onClick={handleOpen}>
                            <Avatar
                                variant='rounded'
                                sx={{
                                    ...theme.typography.commonAvatar,
                                    ...theme.typography.mediumAvatar,
                                    transition: 'all .2s ease-in-out',
                                    background: theme.palette.secondary.light,
                                    color: theme.palette.secondary.dark,
                                    '&:hover': {
                                        background: theme.palette.secondary.dark,
                                        color: theme.palette.secondary.light
                                    }
                                }}
                                color='inherit'
                            >
                                <IconLanguage stroke={1.5} size='1.3rem' />
                            </Avatar>
                        </ButtonBase>
                    </LangBadge>
                </span>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem disabled>
                    <ListItemText primary={t('header.language.menuTitle')} />
                </MenuItem>
                <Divider />
                {languageItems.map((l) => {
                    const selected = currentLang === normalizeLang(l.code)
                    return (
                        <MenuItem key={l.code} onClick={() => handleChange(l.code)} selected={selected}>
                            <ListItemIcon>{selected ? <IconCheck size={16} /> : <Box sx={{ width: 16, height: 16 }} />}</ListItemIcon>
                            <ListItemText primary={l.label} />
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}

export default LanguageSwitcher
