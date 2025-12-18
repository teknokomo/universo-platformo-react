// Universo Platformo | Agents Frontend - ValidationPopUp Component
// Adapted from Flowise 3.0.12 ValidationPopUp.jsx
// Shows validation checklist for AgentFlow canvas

import { useState, useRef, useEffect, memo, type ReactNode, type FC } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Typography, Box, ClickAwayListener, Paper, Popper, Button, Fab } from '@mui/material'
import { useTheme, alpha, lighten, darken, styled } from '@mui/material/styles'
import { IconCheckbox, IconMessage, IconX, IconExclamationCircle, IconChecklist } from '@tabler/icons-react'

// Store
import { enqueueSnackbar as enqueueSnackbarAction } from '@flowise/store'
// Local AGENTFLOW_ICONS copy for tsc compatibility with moduleResolution: node
import { AGENTFLOW_ICONS, type AgentFlowIcon } from '../constants/agentflowIcons'

// Import i18n as side effect
import '../i18n'

// Styled FAB component
const StyledFab = styled(Fab)(({ theme }) => ({
    boxShadow: 'none',
    '&:hover': {
        boxShadow: theme.shadows[4]
    }
}))

// Simple card component
const MainCard = styled(Paper)(({ theme }) => ({
    borderRadius: '12px',
    overflow: 'hidden'
}))

/** Validation result item interface */
interface ValidationItem {
    id: string
    name: string
    label: string
    issues: string[]
    type?: string
}

/** Customization state interface */
interface CustomizationState {
    isDarkMode?: boolean
}

/** Redux state interface */
interface RootState {
    customization?: CustomizationState
}

/** Component props */
interface ValidationPopUpProps {
    /** Canvas/chatflow ID to validate */
    canvasId: string
    /** Whether the popup should be hidden */
    hidden?: boolean
    /** API function to call for validation */
    validateApi: (canvasId: string) => Promise<{ data: ValidationItem[] }>
}

const ValidationPopUp: FC<ValidationPopUpProps> = ({ canvasId, hidden, validateApi }) => {
    const { t } = useTranslation('agents')
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state: RootState) => state.customization)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enqueueSnackbar = (payload: any) => dispatch(enqueueSnackbarAction(payload))

    const [open, setOpen] = useState(false)
    const [previews, setPreviews] = useState<ValidationItem[]>([])
    const [loading, setLoading] = useState(false)

    const anchorRef = useRef<HTMLButtonElement>(null)
    const prevOpen = useRef(open)

    const handleClose = (event: MouseEvent | TouchEvent) => {
        if (anchorRef.current && anchorRef.current.contains(event.target as Node)) {
            return
        }
        setOpen(false)
    }

    const handleToggle = () => {
        setOpen((prev) => !prev)
    }

    const validateFlow = async () => {
        if (!canvasId) return

        try {
            setLoading(true)
            const response = await validateApi(canvasId)
            setPreviews(response.data)

            if (response.data.length === 0) {
                enqueueSnackbar({
                    message: t('validation.noIssues'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        autoHideDuration: 3000
                    }
                })
            }
        } catch (error) {
            console.error(error)
            enqueueSnackbar({
                message: error instanceof Error ? error.message : t('validation.failedToValidate'),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    autoHideDuration: 3000
                }
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (prevOpen.current === true && open === false) {
            anchorRef.current?.focus()
        }
        prevOpen.current = open
    }, [open, canvasId])

    const getNodeIcon = (item: ValidationItem): ReactNode => {
        const nodeName = item.name

        // Find matching icon from AGENTFLOW_ICONS
        const foundIcon = (AGENTFLOW_ICONS as AgentFlowIcon[]).find((icon) => icon.name === nodeName)

        if (foundIcon) {
            const IconComponent = foundIcon.icon
            return (
                <Box
                    sx={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        backgroundColor: foundIcon.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}
                >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <IconComponent {...({ size: 16 } as any)} />
                </Box>
            )
        }

        // Default icon if no match found
        return (
            <Box
                sx={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: item.type === 'LLM' ? '#4747d1' : '#f97316',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                }}
            >
                {item.type === 'LLM' ? <span>ℓ</span> : <IconMessage size={16} />}
            </Box>
        )
    }

    // Empty state SVG as inline data URI to avoid module resolution issues
    const emptyStateSvg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect fill="#f5f5f5" width="200" height="150"/><circle cx="100" cy="60" r="30" fill="#673ab7"/><path d="M90 60l7 7 13-13" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="100" y="120" text-anchor="middle" fill="#666" font-size="12">All good!</text></svg>')}`

    // Background color helper
    const getBackgroundColor = (): string => {
        if (customization?.isDarkMode) {
            return theme.palette.background.paper
        }
        // Use neutral if available, otherwise fallback
        const bg = theme.palette.background as { neutral?: string }
        return bg.neutral || '#f5f5f5'
    }

    return (
        <>
            {!hidden && (
                <StyledFab
                    sx={{
                        position: 'absolute',
                        right: 80,
                        top: 20,
                        backgroundColor: '#009688', // teal color like Flowise
                        color: 'white',
                        '&:hover': {
                            backgroundColor: '#00796b'
                        }
                    }}
                    ref={anchorRef}
                    size="small"
                    aria-label="validation"
                    title={t('validation.title') as string}
                    onClick={handleToggle}
                >
                    {open ? <IconX color="white" /> : <IconChecklist color="white" />}
                </StyledFab>
            )}

            <Popper
                placement="bottom-end"
                open={open && !hidden}
                anchorEl={anchorRef.current}
                role={undefined}
                disablePortal
                popperOptions={{
                    modifiers: [
                        {
                            name: 'offset',
                            options: {
                                offset: [80, 14]
                            }
                        }
                    ]
                }}
                sx={{ zIndex: 1000 }}
            >
                <Paper>
                    <ClickAwayListener onClickAway={handleClose}>
                        <MainCard
                            elevation={16}
                            sx={{
                                p: 2,
                                width: '400px',
                                maxWidth: '100%',
                                boxShadow: theme.shadows[16]
                            }}
                        >
                            <Typography variant="h4" sx={{ mt: 1, mb: 2 }}>
                                {t('validation.title')} ({previews.length})
                            </Typography>

                            <Box
                                sx={{
                                    maxHeight: '60vh',
                                    overflowY: 'auto',
                                    pr: 1,
                                    mr: -1
                                }}
                            >
                                {previews.length > 0 ? (
                                    previews.map((item, index) => (
                                        <Paper
                                            key={index}
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                mb: 2,
                                                backgroundColor: getBackgroundColor(),
                                                borderRadius: '8px',
                                                border: `1px solid ${alpha('#FFB938', customization?.isDarkMode ? 0.3 : 0.5)}`
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                {getNodeIcon(item)}
                                                <div style={{ fontWeight: 500 }}>{item.label || item.name}</div>
                                            </div>

                                            <Box sx={{ mt: 2 }} />

                                            {item.issues.map((issue, issueIndex) => (
                                                <Box
                                                    key={issueIndex}
                                                    sx={{
                                                        pt: 2,
                                                        px: 2,
                                                        pb: issueIndex === item.issues.length - 1 ? 2 : 1,
                                                        backgroundColor: customization?.isDarkMode
                                                            ? darken('#FFB938', 0.85)
                                                            : lighten('#FFB938', 0.9),
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 2
                                                    }}
                                                >
                                                    <IconExclamationCircle
                                                        color="#FFB938"
                                                        size={20}
                                                        style={{
                                                            minWidth: '20px',
                                                            width: '20px',
                                                            height: '20px',
                                                            flexShrink: 0
                                                        }}
                                                    />
                                                    <span>{issue}</span>
                                                </Box>
                                            ))}
                                        </Paper>
                                    ))
                                ) : (
                                    <Box
                                        sx={{
                                            p: 2,
                                            height: 'auto',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <img
                                            style={{ objectFit: 'cover', height: '15vh', width: 'auto' }}
                                            src={emptyStateSvg}
                                            alt={t('validation.empty.title') as string}
                                        />
                                    </Box>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1 }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={validateFlow}
                                    disabled={loading}
                                    startIcon={loading ? null : <IconCheckbox size={18} />}
                                    sx={{ color: 'white', minWidth: '120px' }}
                                >
                                    {loading ? t('validation.validating') : t('validation.validateFlow')}
                                </Button>
                            </Box>
                        </MainCard>
                    </ClickAwayListener>
                </Paper>
            </Popper>
        </>
    )
}

ValidationPopUp.propTypes = {
    canvasId: PropTypes.string.isRequired,
    hidden: PropTypes.bool,
    validateApi: PropTypes.func.isRequired
}

export default memo(ValidationPopUp)
