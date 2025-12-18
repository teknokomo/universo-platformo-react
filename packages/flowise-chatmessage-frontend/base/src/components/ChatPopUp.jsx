import { useState, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'

import { ClickAwayListener, Paper, Popper, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconMessage, IconX, IconEraser, IconArrowsMaximize } from '@tabler/icons-react'

// project import
import { StyledFab } from '@flowise/template-mui'
import { MainCard } from '@flowise/template-mui'
import { Transitions } from '@flowise/template-mui'
import { ChatMessage } from './ChatMessage'
import ChatExpandDialog from './ChatExpandDialog'

// api
import { api } from '@universo/api-client' // Replaced import canvasMessagesApi from '@/api/canvasMessages'

// Hooks
import useConfirm from '@flowise/template-mui/hooks/useConfirm'
import { useNotifier } from '@flowise/template-mui/hooks'

// Const
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'

// Utils
import { getLocalStorageChatflow, removeLocalStorageChatHistory } from '@universo/utils/ui-utils/genericHelper'

export const ChatPopUp = ({ canvasId: propCanvasId, isAgentCanvas, unikId, spaceId, onOpenChange }) => {
    const theme = useTheme()
    const { confirm } = useConfirm()
    const dispatch = useDispatch()
    const { t } = useTranslation('chatmessage')

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [open, setOpen] = useState(false)
    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})
    const [previews, setPreviews] = useState([])

    const anchorRef = useRef(null)
    const prevOpen = useRef(open)

    // Maintain hook for potential agent-specific handling
    const canvasId = propCanvasId

    const handleClose = (event) => {
        if (anchorRef.current && anchorRef.current.contains(event.target)) {
            return
        }
        setOpen(false)
        if (onOpenChange) onOpenChange(false)
    }

    const handleToggle = () => {
        const newOpenState = !open
        setOpen(newOpenState)
        if (onOpenChange) onOpenChange(newOpenState)
    }

    const expandChat = () => {
        const props = {
            open: true,
            canvasId: canvasId,
            unikId,
            spaceId
        }
        setExpandDialogProps(props)
        setShowExpandDialog(true)
    }

    const resetChatDialog = () => {
        const props = {
            ...expandDialogProps,
            open: false
        }
        setExpandDialogProps(props)
        setTimeout(() => {
            const resetProps = {
                ...expandDialogProps,
                open: true
            }
            setExpandDialogProps(resetProps)
        }, 500)
    }

    const clearChat = async () => {
        const confirmPayload = {
            title: t('chat.clearChatHistory'),
            description: t('chat.clearChatHistoryConfirm'),
            confirmButtonName: t('chat.clear'),
            cancelButtonName: t('common.cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                const objChatDetails = getLocalStorageChatflow(canvasId)
                if (!objChatDetails.chatId) return
                await api.canvasMessages.deleteCanvasMessages(canvasId, {
                    chatId: objChatDetails.chatId,
                    chatType: 'INTERNAL'
                })
                removeLocalStorageChatHistory(canvasId)
                resetChatDialog()
                enqueueSnackbar({
                    message: t('chat.clearedChatHistory'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            } catch (error) {
                enqueueSnackbar({
                    message: typeof error.response.data === 'object' ? error.response.data.message : error.response.data,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
    }

    useEffect(() => {
        if (prevOpen.current === true && open === false) {
            anchorRef.current.focus()
            if (onOpenChange) onOpenChange(false)
        }
        prevOpen.current = open

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, canvasId])

    return (
        <>
            <StyledFab
                sx={{ position: 'absolute', right: 20, top: 20 }}
                ref={anchorRef}
                size='small'
                color='secondary'
                aria-label='chat'
                title={t('chat.chat')}
                onClick={handleToggle}
            >
                {open ? <IconX /> : <IconMessage />}
            </StyledFab>
            {open && (
                <StyledFab
                    sx={{ position: 'absolute', right: 80, top: 20 }}
                    onClick={clearChat}
                    size='small'
                    color='error'
                    aria-label='clear'
                    title={t('chat.clearChatHistory')}
                >
                    <IconEraser />
                </StyledFab>
            )}
            {open && (
                <StyledFab
                    sx={{ position: 'absolute', right: 140, top: 20 }}
                    onClick={expandChat}
                    size='small'
                    color='primary'
                    aria-label='expand'
                    title={t('chat.expandChat')}
                >
                    <IconArrowsMaximize />
                </StyledFab>
            )}
            <Popper
                placement='bottom-end'
                open={open}
                anchorEl={anchorRef.current}
                role={undefined}
                transition
                disablePortal
                popperOptions={{
                    modifiers: [
                        {
                            name: 'offset',
                            options: {
                                offset: [40, 14]
                            }
                        }
                    ]
                }}
                sx={{ zIndex: 1000 }}
            >
                {({ TransitionProps }) => (
                    <Transitions in={open} {...TransitionProps}>
                        <Paper>
                            <ClickAwayListener onClickAway={handleClose}>
                                <MainCard
                                    border={false}
                                    className='cloud-wrapper'
                                    elevation={16}
                                    content={false}
                                    boxShadow
                                    shadow={theme.shadows[16]}
                                >
                                    <ChatMessage
                                        isAgentCanvas={isAgentCanvas}
                                        canvasId={canvasId}
                                        unikId={unikId}
                                        spaceId={spaceId}
                                        open={open}
                                        previews={previews}
                                        setPreviews={setPreviews}
                                    />
                                </MainCard>
                            </ClickAwayListener>
                        </Paper>
                    </Transitions>
                )}
            </Popper>
            <ChatExpandDialog
                show={showExpandDialog}
                dialogProps={expandDialogProps}
                isAgentCanvas={isAgentCanvas}
                onClear={clearChat}
                onCancel={() => setShowExpandDialog(false)}
                previews={previews}
                setPreviews={setPreviews}
            ></ChatExpandDialog>
        </>
    )
}

ChatPopUp.propTypes = {
    canvasId: PropTypes.string,
    isAgentCanvas: PropTypes.bool,
    unikId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    spaceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onOpenChange: PropTypes.func
}
