import React, { useRef, useEffect } from 'react'
import { Box, IconButton, OutlinedInput, Toolbar, Typography, Fab } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconSearch, IconArrowLeft, IconEdit } from '@tabler/icons-react'

type OS = 'macos' | 'windows' | 'linux' | 'other'

function getOS(): OS {
    if (typeof navigator === 'undefined') return 'other'
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) return 'macos'
    if (ua.includes('win')) return 'windows'
    if (ua.includes('linux')) return 'linux'
    return 'other'
}

function useSearchShortcut(inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const isMac = getOS() === 'macos'
            if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [inputRef])
}

export interface ViewHeaderProps {
    children?: React.ReactNode
    filters?: React.ReactNode
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    search?: boolean
    searchPlaceholder?: string
    title?: string
    description?: string
    isBackButton?: boolean
    onBack?: () => void
    isEditButton?: boolean
    onEdit?: () => void
}

const ViewHeader: React.FC<ViewHeaderProps> = ({
    children,
    filters = null,
    onSearchChange,
    search,
    searchPlaceholder = 'Search',
    title,
    description,
    isBackButton,
    onBack,
    isEditButton,
    onEdit
}) => {
    const theme = useTheme()
    const searchInputRef = useRef<HTMLInputElement | null>(null)
    useSearchShortcut(searchInputRef)

    const os = getOS()
    const isMac = os === 'macos'
    const isDesktop = isMac || os === 'windows' || os === 'linux'
    const keyboardShortcut = isMac ? '[ ⌘ + F ]' : '[ Ctrl + F ]'

    return (
        <Box sx={{ flexGrow: 1, py: 0, width: '100%' }}>
            <Toolbar
                disableGutters
                sx={{ p: 0, minHeight: 'auto', alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between', width: '100%' }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'row', ml: { xs: -1.5, md: -2 }, mt: 0 }}>
                    {isBackButton && (
                        <Fab sx={{ mr: 3 }} size='small' color='secondary' aria-label='back' title='Back' onClick={onBack}>
                            <IconArrowLeft />
                        </Fab>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'start', flexDirection: 'column' }}>
                        <Typography
                            sx={{
                                fontSize: '2rem',
                                fontWeight: 600,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                flex: 1,
                                maxWidth: '100%'
                            }}
                            variant='h1'
                        >
                            {title}
                        </Typography>
                        {description && (
                            <Typography
                                sx={{
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    mt: 2,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 5,
                                    WebkitBoxOrient: 'vertical',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    flex: 1,
                                    maxWidth: '100%'
                                }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Box>
                    {isEditButton && (
                        <IconButton sx={{ ml: 3 }} color='secondary' title='Edit' onClick={onEdit}>
                            <IconEdit />
                        </IconButton>
                    )}
                </Box>
                <Box sx={{ height: 40, display: 'flex', alignItems: 'center', gap: 1, mr: { xs: -1.5, md: -2 } }}>
                    {search && (
                        <OutlinedInput
                            inputRef={searchInputRef}
                            size='small'
                            sx={{
                                width: '325px',
                                height: '100%',
                                display: { xs: 'none', sm: 'flex' },
                                borderRadius: 1,
                                '& .MuiOutlinedInput-notchedOutline': { borderRadius: 1 }
                            }}
                            placeholder={`${searchPlaceholder} ${isDesktop ? keyboardShortcut : ''}`}
                            onChange={onSearchChange}
                            startAdornment={
                                <Box
                                    sx={{
                                        color: theme.palette.grey[400],
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mr: 1
                                    }}
                                >
                                    <IconSearch style={{ color: 'inherit', width: 16, height: 16 }} />
                                </Box>
                            }
                            type='search'
                        />
                    )}
                    {filters}
                    {children}
                </Box>
            </Toolbar>
        </Box>
    )
}

export default ViewHeader
