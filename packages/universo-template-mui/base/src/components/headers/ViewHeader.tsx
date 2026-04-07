import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Box, ClickAwayListener, IconButton, OutlinedInput, Toolbar, Typography, Fab } from '@mui/material'
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

const VIEW_HEADER_TITLE_REGION_TEST_ID = 'view-header-title-region'
const VIEW_HEADER_CONTROLS_REGION_TEST_ID = 'view-header-controls-region'
const VIEW_HEADER_SEARCH_INPUT_TEST_ID = 'view-header-search-input'
const VIEW_HEADER_ACTIONS_REGION_TEST_ID = 'view-header-actions-region'

export interface ViewHeaderProps {
    children?: React.ReactNode
    filters?: React.ReactNode
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    search?: boolean
    searchValue?: string
    searchPlaceholder?: string
    title?: string
    description?: string
    isBackButton?: boolean
    onBack?: () => void
    isEditButton?: boolean
    onEdit?: () => void
    controlsWrap?: boolean
    adaptiveSearch?: boolean
}

/**
 * CollapsibleMobileSearch — icon button that expands into full-width search overlay on mobile.
 * Uses ClickAwayListener for reliable close-on-outside-click (incl. touch + Portals).
 */
const CollapsibleMobileSearch: React.FC<{
    searchPlaceholder: string
    searchValue: string
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}> = ({ searchPlaceholder, searchValue, onSearchChange }) => {
    const [expanded, setExpanded] = useState(false)
    const mobileInputRef = useRef<HTMLInputElement>(null)

    const handleClose = useCallback(() => {
        setExpanded(false)
    }, [])

    // Focus the input when mobile search expands (imperative instead of autoFocus for a11y)
    useEffect(() => {
        if (!expanded) return undefined
        const frameId = window.requestAnimationFrame(() => {
            mobileInputRef.current?.focus()
        })
        return () => window.cancelAnimationFrame(frameId)
    }, [expanded])

    if (!expanded) {
        return (
            <IconButton aria-label='Open search' title='Open search' onClick={() => setExpanded(true)} size='medium'>
                <IconSearch style={{ width: 20, height: 20 }} />
            </IconButton>
        )
    }

    return (
        <ClickAwayListener onClickAway={handleClose}>
            <Box
                sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'background.paper'
                }}
            >
                <OutlinedInput
                    inputRef={mobileInputRef}
                    fullWidth
                    size='small'
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={onSearchChange}
                    startAdornment={
                        <Box sx={{ color: 'grey.400', display: 'flex', mr: 1 }}>
                            <IconSearch style={{ color: 'inherit', width: 16, height: 16 }} />
                        </Box>
                    }
                    type='search'
                />
            </Box>
        </ClickAwayListener>
    )
}

const ViewHeader: React.FC<ViewHeaderProps> = ({
    children,
    filters = null,
    onSearchChange,
    search,
    searchValue,
    searchPlaceholder = 'Search',
    title,
    description,
    isBackButton,
    onBack,
    isEditButton,
    onEdit,
    controlsWrap = false,
    adaptiveSearch = false
}) => {
    const theme = useTheme()
    const desktopSearchRef = useRef<HTMLInputElement | null>(null)
    const [internalSearchValue, setInternalSearchValue] = useState(searchValue ?? '')
    useSearchShortcut(desktopSearchRef)

    useEffect(() => {
        if (typeof searchValue === 'string') {
            setInternalSearchValue(searchValue)
        }
    }, [searchValue])

    const resolvedSearchValue = searchValue ?? internalSearchValue

    const handleSearchInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setInternalSearchValue(event.target.value)
            onSearchChange?.(event)
        },
        [onSearchChange]
    )

    const os = useMemo(() => getOS(), [])
    const isMac = os === 'macos'
    const isDesktop = isMac || os === 'windows' || os === 'linux'
    const keyboardShortcut = isMac ? '[ ⌘ + F ]' : '[ Ctrl + F ]'
    const hasTitleRegion = Boolean(title || description || isBackButton || isEditButton)

    return (
        <Box
            sx={{
                flexGrow: 1,
                width: '100%',
                pt: { xs: 2, sm: 0 },
                pb: { xs: 2, sm: 0 }
            }}
        >
            <Toolbar
                disableGutters
                sx={{
                    p: 0,
                    minHeight: 'auto',
                    alignItems: { xs: 'stretch', sm: 'flex-start' },
                    display: 'flex',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    justifyContent: hasTitleRegion ? 'space-between' : 'flex-start',
                    width: '100%'
                }}
            >
                {hasTitleRegion ? (
                    <Box
                        data-testid={VIEW_HEADER_TITLE_REGION_TEST_ID}
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            flexDirection: 'row',
                            mt: 0,
                            minWidth: 0,
                            width: { xs: '100%', sm: 'auto' }
                        }}
                    >
                        {isBackButton && (
                            <Fab sx={{ mr: 3 }} size='small' color='secondary' aria-label='back' title='Back' onClick={onBack}>
                                <IconArrowLeft />
                            </Fab>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'start', flexDirection: 'column', minWidth: 0 }}>
                            {title ? (
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
                            ) : null}
                            {description && (
                                <Typography
                                    sx={{
                                        fontSize: '1rem',
                                        fontWeight: 500,
                                        mt: title ? 2 : 0,
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
                ) : null}
                <Box
                    data-testid={VIEW_HEADER_CONTROLS_REGION_TEST_ID}
                    sx={{
                        minHeight: 40,
                        height: controlsWrap ? 'auto' : 40,
                        display: 'flex',
                        alignItems: controlsWrap ? 'flex-start' : 'center',
                        flexWrap: { xs: 'wrap', sm: controlsWrap ? 'wrap' : 'nowrap' },
                        rowGap: controlsWrap ? 1 : 0,
                        gap: 1,
                        ml: 0,
                        mt: { xs: 2, sm: 0 },
                        width: { xs: '100%', sm: hasTitleRegion ? 'auto' : '100%' },
                        position: 'relative',
                        justifyContent: {
                            xs: 'flex-start',
                            sm: hasTitleRegion ? (controlsWrap ? 'flex-start' : 'flex-end') : 'flex-start'
                        }
                    }}
                >
                    {search && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                                flex:
                                    adaptiveSearch || controlsWrap
                                        ? { xs: '1 1 auto', sm: adaptiveSearch ? '0 0 auto' : '1 1 220px', md: adaptiveSearch ? '1 1 220px' : undefined }
                                        : undefined,
                                minWidth: adaptiveSearch || controlsWrap ? 0 : undefined,
                                width:
                                    adaptiveSearch || controlsWrap
                                        ? { xs: 'auto', sm: adaptiveSearch ? 'auto' : '100%', md: adaptiveSearch ? 'min(100%, 260px)' : 'auto' }
                                        : undefined
                            }}
                        >
                            <OutlinedInput
                                data-testid={VIEW_HEADER_SEARCH_INPUT_TEST_ID}
                                inputRef={desktopSearchRef}
                                size='small'
                                sx={{
                                    width: {
                                        xs: '100%',
                                        sm: controlsWrap ? '100%' : adaptiveSearch ? 'min(100%, 220px)' : '325px',
                                        md: adaptiveSearch ? 'min(100%, 260px)' : '325px'
                                    },
                                    maxWidth: adaptiveSearch ? 260 : 325,
                                    height: 40,
                                    minHeight: 40,
                                    display: adaptiveSearch ? { xs: 'none', sm: 'none', md: 'flex' } : { xs: 'none', sm: 'flex' },
                                    borderRadius: 1,
                                    '& .MuiOutlinedInput-notchedOutline': { borderRadius: 1 }
                                }}
                                placeholder={`${searchPlaceholder} ${isDesktop ? keyboardShortcut : ''}`}
                                value={resolvedSearchValue}
                                onChange={handleSearchInputChange}
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

                            <Box sx={{ display: adaptiveSearch ? { xs: 'flex', sm: 'flex', md: 'none' } : { xs: 'flex', sm: 'none' } }}>
                                <CollapsibleMobileSearch
                                    searchPlaceholder={searchPlaceholder}
                                    searchValue={resolvedSearchValue}
                                    onSearchChange={handleSearchInputChange}
                                />
                            </Box>
                        </Box>
                    )}
                    {(filters || children) && (
                        <Box
                            data-testid={VIEW_HEADER_ACTIONS_REGION_TEST_ID}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                ml: controlsWrap ? 0 : search || hasTitleRegion ? 'auto' : 0,
                                flexShrink: 0,
                                flexWrap: controlsWrap ? 'wrap' : 'nowrap',
                                justifyContent: controlsWrap ? 'flex-start' : undefined,
                                width: { xs: '100%', sm: hasTitleRegion ? 'auto' : 'auto' }
                            }}
                        >
                            {filters}
                            {children}
                        </Box>
                    )}
                </Box>
            </Toolbar>
        </Box>
    )
}

export default ViewHeader
