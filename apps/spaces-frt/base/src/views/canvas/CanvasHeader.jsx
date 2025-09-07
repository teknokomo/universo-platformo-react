import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Box, ButtonBase, Typography, Stack, TextField, Button, CircularProgress } from '@mui/material'

// icons
import { IconSettings, IconChevronLeft, IconDeviceFloppy, IconPencil, IconCheck, IconX, IconCode } from '@tabler/icons-react'

// project imports
import Settings from '@/views/settings'
import SaveChatflowDialog from '@/ui-component/dialog/SaveChatflowDialog'
import spacesApi from '../../api/spaces'
import APICodeDialog from '@/views/chatflows/APICodeDialog'
import ViewMessagesDialog from '@/ui-component/dialog/ViewMessagesDialog'
import ChatflowConfigurationDialog from '@/ui-component/dialog/ChatflowConfigurationDialog'
import UpsertHistoryDialog from '@/views/vectorstore/UpsertHistoryDialog'
import ViewLeadsDialog from '@/ui-component/dialog/ViewLeadsDialog'
import ExportAsTemplateDialog from '@/ui-component/dialog/ExportAsTemplateDialog'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '../../hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// utils
import { generateExportFlowData } from '@/utils/genericHelper'
import { uiBaseURL } from '@/store/constant'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction, SET_CHATFLOW, REMOVE_DIRTY } from '@/store/actions'

// ==============================|| CANVAS HEADER ||============================== //

const CanvasHeader = ({ chatflow, isAgentCanvas, handleSaveFlow, handleDeleteFlow, handleLoadFlow, spaceId, spaceName, spaceLoading, onRenameSpace }) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const flowNameRef = useRef()
    const settingsRef = useRef()
    const { t } = useTranslation('canvas')

    const [isEditingFlowName, setEditingFlowName] = useState(null)
    const [flowName, setFlowName] = useState('')
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [flowDialogOpen, setFlowDialogOpen] = useState(false)
    const [apiDialogOpen, setAPIDialogOpen] = useState(false)
    const [apiDialogProps, setAPIDialogProps] = useState({})
    const [viewMessagesDialogOpen, setViewMessagesDialogOpen] = useState(false)
    const [viewMessagesDialogProps, setViewMessagesDialogProps] = useState({})
    const [viewLeadsDialogOpen, setViewLeadsDialogOpen] = useState(false)
    const [viewLeadsDialogProps, setViewLeadsDialogProps] = useState({})
    const [upsertHistoryDialogOpen, setUpsertHistoryDialogOpen] = useState(false)
    const [upsertHistoryDialogProps, setUpsertHistoryDialogProps] = useState({})
    const [chatflowConfigurationDialogOpen, setChatflowConfigurationDialogOpen] = useState(false)
    const [chatflowConfigurationDialogProps, setChatflowConfigurationDialogProps] = useState({})

    const [exportAsTemplateDialogOpen, setExportAsTemplateDialogOpen] = useState(false)
    const [exportAsTemplateDialogProps, setExportAsTemplateDialogProps] = useState({})
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))
    const { confirm } = useConfirm()

    const titleLabel = isAgentCanvas ? t('agent', 'agent') : t('space', 'space')

    const updateChatflowApi = useApi(chatflowsApi.updateChatflow)
    const deleteSpaceApi = useApi(spacesApi.deleteSpace)
    const canvas = useSelector((state) => state.canvas)

    const onSettingsItemClick = (setting) => {
        setSettingsOpen(false)

        if (setting === 'deleteSpace' && !isAgentCanvas) {
            // Подтверждение удаления пространства целиком
            const pathParts = location.pathname.split('/')
            const unikIdIndex = pathParts.indexOf('uniks') + 1
            const currentUnikId = unikIdIndex > 0 && unikIdIndex < pathParts.length ? pathParts[unikIdIndex] : ''

            const title = t('confirmDeleteSpaceTitle', 'Delete Space')
            const description = t('confirmDeleteSpaceDescription', 'This will delete the space and all its canvases. This action cannot be undone.')

            confirm({ title, description }).then((confirmed) => {
                if (!confirmed) return
                deleteSpaceApi
                    .request(currentUnikId, String(spaceId))
                    .then(() => {
                        navigate(`/uniks/${currentUnikId}/spaces`)
                    })
                    .catch((error) => {
                        enqueueSnackbar({
                            message: error?.response?.data?.error || error?.message,
                            options: { key: new Date().getTime() + Math.random(), variant: 'error', persist: true,
                                action: (key) => (
                                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                        <IconX />
                                    </Button>
                                )
                            }
                        })
                    })
            })
        } else if (setting === 'deleteChatflow') {
            handleDeleteFlow()
        } else if (setting === 'viewMessages') {
            setViewMessagesDialogProps({
                title: 'View Messages',
                chatflow: chatflow
            })
            setViewMessagesDialogOpen(true)
        } else if (setting === 'viewLeads') {
            setViewLeadsDialogProps({
                title: 'View Leads',
                chatflow: chatflow
            })
            setViewLeadsDialogOpen(true)
        } else if (setting === 'saveAsTemplate') {
            if (canvas.isDirty) {
                enqueueSnackbar({
                    message: t('messages.saveFirst'),
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
                return
            }

            // Check if chatflow has an ID
            if (!chatflow || !chatflow.id) {
                enqueueSnackbar({
                    message: t('messages.exportError') + ' ' + title + '!',
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
                return
            }

            // Get unikId from URL using useLocation hook
            const pathParts = location.pathname.split('/')
            const unikIdIndex = pathParts.indexOf('uniks') + 1
            const currentUnikId = unikIdIndex > 0 && unikIdIndex < pathParts.length ? pathParts[unikIdIndex] : ''

            setExportAsTemplateDialogProps({
                title: 'Export As Template',
                chatflow: chatflow,
                unikId: currentUnikId
            })
            setExportAsTemplateDialogOpen(true)
        } else if (setting === 'viewUpsertHistory') {
            setUpsertHistoryDialogProps({
                title: 'View Upsert History',
                chatflow: chatflow
            })
            setUpsertHistoryDialogOpen(true)
        } else if (setting === 'chatflowConfiguration') {
            setChatflowConfigurationDialogProps({
                title: `${title} Configuration`,
                chatflow: chatflow
            })
            setChatflowConfigurationDialogOpen(true)
        } else if (setting === 'duplicateChatflow') {
            try {
                let flowData = chatflow.flowData
                const parsedFlowData = JSON.parse(flowData)
                flowData = JSON.stringify(parsedFlowData)
                localStorage.setItem('duplicatedFlowData', flowData)

                const parentUnikId = localStorage.getItem('parentUnikId')

                window.open(`${uiBaseURL}/uniks/${parentUnikId}/${isAgentCanvas ? 'agentcanvas' : 'chatflows'}/new`, '_blank')
            } catch (e) {
                console.error(e)
            }
        } else if (setting === 'exportChatflow') {
            try {
                const flowData = JSON.parse(chatflow.flowData)
                let dataStr = JSON.stringify(generateExportFlowData(flowData), null, 2)
                //let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
                const blob = new Blob([dataStr], { type: 'application/json' })
                const dataUri = URL.createObjectURL(blob)

                let exportFileDefaultName = `${chatflow.name} ${title}.json`

                let linkElement = document.createElement('a')
                linkElement.setAttribute('href', dataUri)
                linkElement.setAttribute('download', exportFileDefaultName)
                linkElement.click()
            } catch (e) {
                console.error(e)
            }
        }
    }

    const onUploadFile = (file) => {
        setSettingsOpen(false)
        handleLoadFlow(file)
    }

    const submitFlowName = async () => {
        const newName = flowNameRef.current.value
        try {
            if (!isAgentCanvas && spaceId && onRenameSpace) {
                await onRenameSpace(newName)
                setFlowName(newName)
            } else {
                handleSaveFlow(newName)
            }
        } finally {
            setEditingFlowName(false)
        }
    }

    const onAPIDialogClick = () => {
        // If file type is file, isFormDataRequired = true
        let isFormDataRequired = false
        try {
            const flowData = JSON.parse(chatflow.flowData)
            const nodes = flowData.nodes
            for (const node of nodes) {
                if (node.data.inputParams.find((param) => param.type === 'file')) {
                    isFormDataRequired = true
                    break
                }
            }
        } catch (e) {
            console.error(e)
        }

        // If sessionId memory, isSessionMemory = true
        let isSessionMemory = false
        try {
            const flowData = JSON.parse(chatflow.flowData)
            const nodes = flowData.nodes
            for (const node of nodes) {
                if (node.data.inputParams.find((param) => param.name === 'sessionId')) {
                    isSessionMemory = true
                    break
                }
            }
        } catch (e) {
            console.error(e)
        }

        setAPIDialogProps({
            title: 'Embed in website or use as API',
            chatflowid: chatflow.id,
            chatflowApiKeyId: chatflow.apikeyid,
            isFormDataRequired,
            isSessionMemory,
            isAgentCanvas
        })
        setAPIDialogOpen(true)
    }

    const onSaveChatflowClick = () => {
        if (chatflow.id) handleSaveFlow(flowName)
        else setFlowDialogOpen(true)
    }

    const onConfirmSaveName = (flowName) => {
        setFlowDialogOpen(false)
        handleSaveFlow(flowName)
        dispatch({ type: REMOVE_DIRTY })
    }

    useEffect(() => {
        if (updateChatflowApi.data) {
            setFlowName(updateChatflowApi.data.name)
            dispatch({ type: SET_CHATFLOW, chatflow: updateChatflowApi.data })
        }
        setEditingFlowName(false)

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateChatflowApi.data])

    useEffect(() => {
        // Avoid showing "Untitled Space" while existing space name is still loading
        const fallback = isAgentCanvas ? t('untitledAgent', 'Untitled Agent') : t('untitledSpace', 'Untitled Space')
        if (isAgentCanvas) {
            setFlowName(chatflow?.name || fallback)
        } else if (spaceId) {
            // Existing space: show actual name when available, otherwise empty to avoid confusion
            setFlowName(spaceName || '')
        } else {
            // New space route: show fallback until user renames
            setFlowName(fallback)
        }

        // if configuration dialog is open, update its data
        if (chatflowConfigurationDialogOpen) {
            setChatflowConfigurationDialogProps({
                title: `${isAgentCanvas ? 'Agent' : 'Space'} Configuration`,
                chatflow
            })
        }
    }, [chatflow, spaceName, spaceId, isAgentCanvas, chatflowConfigurationDialogOpen, t])

    return (
        <>
            <Stack flexDirection='row' justifyContent='space-between' sx={{ width: '100%' }}>
                <Stack flexDirection='row' sx={{ width: '100%', maxWidth: '50%' }}>
                    <Box>
                        <ButtonBase title={t('canvas.back')} sx={{ borderRadius: '50%' }}>
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
                                onClick={() => {
                                    // Get current path using useLocation hook
                                    const currentPath = location.pathname

                                    // Determine the type of canvas based on the path
                                    const isAgentCanvasUrl = currentPath.includes('/agentcanvas')

                                    // Extract unikId from URL
                                    const pathParts = currentPath.split('/')
                                    const unikIdIndex = pathParts.indexOf('uniks') + 1

                                    if (unikIdIndex > 0 && unikIdIndex < pathParts.length) {
                                        const unikId = pathParts[unikIdIndex]
                                        // Redirect to the corresponding list based on URL
                                        const targetPath = isAgentCanvasUrl ? `/uniks/${unikId}/agentflows` : `/uniks/${unikId}/spaces`

                                        navigate(targetPath)
                                    } else {
                                        // If we couldn't extract unikId, redirect to the main page
                                        navigate('/', { replace: true })
                                    }
                                }}
                            >
                                <IconChevronLeft stroke={1.5} size='1.3rem' />
                            </Avatar>
                        </ButtonBase>
                    </Box>
                    <Box sx={{ width: '100%' }}>
                        {!isEditingFlowName ? (
                            <Stack flexDirection='row'>
                                <Stack direction="column" sx={{ ml: 2 }}>
                                    <Typography
                                        sx={{
                                            fontSize: '1.5rem',
                                            fontWeight: 600,
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {canvas.isDirty && <strong style={{ color: theme.palette.orange.main }}>*</strong>}
                                        {spaceId && spaceName ? spaceName : flowName}
                                    </Typography>
                                    {/* Do not show active canvas name under space title */}
                                </Stack>
                                {(spaceId || chatflow?.id) && (
                                    spaceId && !spaceName && spaceLoading ? (
                                        // Show spinner while space name is loading, on the same styled chip as the edit button
                                        <Avatar
                                            variant='rounded'
                                            sx={{
                                                ...theme.typography.commonAvatar,
                                                ...theme.typography.mediumAvatar,
                                                transition: 'all .2s ease-in-out',
                                                ml: 1,
                                                background: theme.palette.secondary.light,
                                                color: theme.palette.secondary.dark
                                            }}
                                        >
                                            <CircularProgress size={18} thickness={5} sx={{ color: theme.palette.secondary.dark }} />
                                        </Avatar>
                                    ) : (
                                        <ButtonBase title={t('editName', 'Edit Name')} sx={{ borderRadius: '50%' }}>
                                            <Avatar
                                                variant='rounded'
                                                sx={{
                                                    ...theme.typography.commonAvatar,
                                                    ...theme.typography.mediumAvatar,
                                                    transition: 'all .2s ease-in-out',
                                                    ml: 1,
                                                    background: theme.palette.secondary.light,
                                                    color: theme.palette.secondary.dark,
                                                    '&:hover': {
                                                        background: theme.palette.secondary.dark,
                                                        color: theme.palette.secondary.light
                                                    }
                                                }}
                                                color='inherit'
                                                onClick={() => setEditingFlowName(true)}
                                            >
                                                <IconPencil stroke={1.5} size='1.3rem' />
                                            </Avatar>
                                        </ButtonBase>
                                    )
                                )}
                            </Stack>
                        ) : (
                            <Stack flexDirection='row' sx={{ width: '100%' }}>
                                <TextField
                                    //eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                    size='small'
                                    inputRef={flowNameRef}
                                    sx={{
                                        width: '100%',
                                        ml: 2
                                    }}
                                    defaultValue={flowName}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            submitFlowName()
                                        } else if (e.key === 'Escape') {
                                            setEditingFlowName(false)
                                        }
                                    }}
                                />
                                <ButtonBase title={t('canvas.saveName')} sx={{ borderRadius: '50%' }}>
                                    <Avatar
                                        variant='rounded'
                                        sx={{
                                            ...theme.typography.commonAvatar,
                                            ...theme.typography.mediumAvatar,
                                            transition: 'all .2s ease-in-out',
                                            background: theme.palette.success.light,
                                            color: theme.palette.success.dark,
                                            ml: 1,
                                            '&:hover': {
                                                background: theme.palette.success.dark,
                                                color: theme.palette.success.light
                                            }
                                        }}
                                        color='inherit'
                                        onClick={submitFlowName}
                                    >
                                        <IconCheck stroke={1.5} size='1.3rem' />
                                    </Avatar>
                                </ButtonBase>
                                <ButtonBase title={t('canvas.cancel')} sx={{ borderRadius: '50%' }}>
                                    <Avatar
                                        variant='rounded'
                                        sx={{
                                            ...theme.typography.commonAvatar,
                                            ...theme.typography.mediumAvatar,
                                            transition: 'all .2s ease-in-out',
                                            background: theme.palette.error.light,
                                            color: theme.palette.error.dark,
                                            ml: 1,
                                            '&:hover': {
                                                background: theme.palette.error.dark,
                                                color: theme.palette.error.light
                                            }
                                        }}
                                        color='inherit'
                                        onClick={() => setEditingFlowName(false)}
                                    >
                                        <IconX stroke={1.5} size='1.3rem' />
                                    </Avatar>
                                </ButtonBase>
                            </Stack>
                        )}
                    </Box>
                </Stack>
                <Box>
                    {chatflow?.id && (
                        <ButtonBase title={t('publishAndExport', 'Publish and Export')} sx={{ borderRadius: '50%', mr: 2 }}>
                            <Avatar
                                variant='rounded'
                                sx={{
                                    ...theme.typography.commonAvatar,
                                    ...theme.typography.mediumAvatar,
                                    transition: 'all .2s ease-in-out',
                                    background: theme.palette.canvasHeader.deployLight,
                                    color: theme.palette.canvasHeader.deployDark,
                                    '&:hover': {
                                        background: theme.palette.canvasHeader.deployDark,
                                        color: theme.palette.canvasHeader.deployLight
                                    }
                                }}
                                color='inherit'
                                onClick={onAPIDialogClick}
                            >
                                <IconCode stroke={1.5} size='1.3rem' />
                            </Avatar>
                        </ButtonBase>
                    )}
                    <ButtonBase title={t('canvas.saveFlow') + ' ' + titleLabel} sx={{ borderRadius: '50%', mr: 2 }}>
                        <Avatar
                            variant='rounded'
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                transition: 'all .2s ease-in-out',
                                background: theme.palette.canvasHeader.saveLight,
                                color: theme.palette.canvasHeader.saveDark,
                                '&:hover': {
                                    background: theme.palette.canvasHeader.saveDark,
                                    color: theme.palette.canvasHeader.saveLight
                                }
                            }}
                            color='inherit'
                            onClick={onSaveChatflowClick}
                        >
                            <IconDeviceFloppy stroke={1.5} size='1.3rem' />
                        </Avatar>
                    </ButtonBase>
                    <ButtonBase ref={settingsRef} title={t('canvas.settings')} sx={{ borderRadius: '50%' }}>
                        <Avatar
                            variant='rounded'
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                transition: 'all .2s ease-in-out',
                                background: theme.palette.canvasHeader.settingsLight,
                                color: theme.palette.canvasHeader.settingsDark,
                                '&:hover': {
                                    background: theme.palette.canvasHeader.settingsDark,
                                    color: theme.palette.canvasHeader.settingsLight
                                }
                            }}
                            onClick={() => setSettingsOpen(!isSettingsOpen)}
                        >
                            <IconSettings stroke={1.5} size='1.3rem' />
                        </Avatar>
                    </ButtonBase>
                </Box>
            </Stack>
            <Settings
                chatflow={chatflow}
                isSettingsOpen={isSettingsOpen}
                anchorEl={settingsRef.current}
                onClose={() => setSettingsOpen(false)}
                onSettingsItemClick={onSettingsItemClick}
                onUploadFile={onUploadFile}
                isAgentCanvas={isAgentCanvas}
            />
            <SaveChatflowDialog
                show={flowDialogOpen}
                dialogProps={{
                    title: isAgentCanvas ? t('saveNewAgent','Save New Agent') : t('saveNewSpace','Save New Space'),
                    confirmButtonName: t('common.save'),
                    cancelButtonName: t('common.cancel'),
                    placeholder: isAgentCanvas ? t('newAgentPlaceholder','My new agent') : t('newSpacePlaceholder','Моё новое пространство')
                }}
                onCancel={() => setFlowDialogOpen(false)}
                onConfirm={onConfirmSaveName}
            />
            {apiDialogOpen && <APICodeDialog show={apiDialogOpen} dialogProps={apiDialogProps} onCancel={() => setAPIDialogOpen(false)} />}
            <ViewMessagesDialog
                show={viewMessagesDialogOpen}
                dialogProps={viewMessagesDialogProps}
                onCancel={() => setViewMessagesDialogOpen(false)}
            />
            <ViewLeadsDialog show={viewLeadsDialogOpen} dialogProps={viewLeadsDialogProps} onCancel={() => setViewLeadsDialogOpen(false)} />
            {exportAsTemplateDialogOpen && (
                <ExportAsTemplateDialog
                    show={exportAsTemplateDialogOpen}
                    dialogProps={exportAsTemplateDialogProps}
                    onCancel={() => setExportAsTemplateDialogOpen(false)}
                />
            )}
            <UpsertHistoryDialog
                show={upsertHistoryDialogOpen}
                dialogProps={upsertHistoryDialogProps}
                onCancel={() => setUpsertHistoryDialogOpen(false)}
            />
            <ChatflowConfigurationDialog
                key='chatflowConfiguration'
                show={chatflowConfigurationDialogOpen}
                dialogProps={chatflowConfigurationDialogProps}
                onCancel={() => setChatflowConfigurationDialogOpen(false)}
                isAgentCanvas={isAgentCanvas}
            />
        </>
    )
}

CanvasHeader.propTypes = {
    chatflow: PropTypes.object,
    handleSaveFlow: PropTypes.func,
    handleDeleteFlow: PropTypes.func,
    handleLoadFlow: PropTypes.func,
    isAgentCanvas: PropTypes.bool,
    spaceId: PropTypes.string,
    spaceName: PropTypes.string,
    spaceLoading: PropTypes.bool
}

export default CanvasHeader
