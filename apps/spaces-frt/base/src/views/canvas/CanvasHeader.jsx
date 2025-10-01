import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Box, ButtonBase, Typography, Stack, TextField, Button, CircularProgress, Chip } from '@mui/material'

// icons
import { IconSettings, IconChevronLeft, IconDeviceFloppy, IconPencil, IconCheck, IconX, IconCode } from '@tabler/icons-react'

// project imports
import Settings from '@/views/settings'
import SaveChatflowDialog from '@/ui-component/dialog/SaveChatflowDialog'
import spacesApi from '../../api/spaces'
import APICodeDialog from '@/views/canvases/APICodeDialog'
import ViewMessagesDialog from '@/ui-component/dialog/ViewMessagesDialog'
import ChatflowConfigurationDialog from '@/ui-component/dialog/ChatflowConfigurationDialog'
import UpsertHistoryDialog from '@/views/vectorstore/UpsertHistoryDialog'
import ViewLeadsDialog from '@/ui-component/dialog/ViewLeadsDialog'
import ExportAsTemplateDialog from '@/ui-component/dialog/ExportAsTemplateDialog'
import CanvasVersionsDialog from './CanvasVersionsDialog'

// API

// Hooks
import useApi from '../../hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// utils
import { generateExportFlowData } from '@/utils/genericHelper'
import { uiBaseURL } from '@/store/constant'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction, SET_CHATFLOW, REMOVE_DIRTY } from '@/store/actions'

// ==============================|| CANVAS HEADER ||============================== //

const CanvasHeader = ({
    chatflow,
    isAgentCanvas,
    handleSaveFlow,
    handleDeleteFlow,
    handleLoadFlow,
    spaceId,
    spaceName,
    spaceLoading,
    onRenameSpace,
    onRefreshCanvases,
    onSelectCanvas
}) => {
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
    const [canvasConfigurationDialogOpen, setCanvasConfigurationDialogOpen] = useState(false)
    const [canvasConfigurationDialogProps, setCanvasConfigurationDialogProps] = useState({})

    const [exportAsTemplateDialogOpen, setExportAsTemplateDialogOpen] = useState(false)
    const [exportAsTemplateDialogProps, setExportAsTemplateDialogProps] = useState({})
    const [canvasVersionsDialogOpen, setCanvasVersionsDialogOpen] = useState(false)
    const [canvasVersionsDialogProps, setCanvasVersionsDialogProps] = useState({})
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))
    const { confirm } = useConfirm()

    const titleLabel = isAgentCanvas ? t('agent', 'agent') : t('space', 'space')

    const deleteSpaceApi = useApi(spacesApi.deleteSpace)
    const canvas = useSelector((state) => state.canvas)

    // Helper: extract unikId from current location path (supports new singular '/unik/:unikId/...')
    const extractUnikId = () => {
        const segments = location.pathname.split('/').filter(Boolean)
        const singularIndex = segments.indexOf('unik')
        if (singularIndex !== -1 && singularIndex + 1 < segments.length) return segments[singularIndex + 1]
        // Legacy fallback (older plural pattern) just in case something still links that way
        const legacyIndex = segments.indexOf('uniks')
        if (legacyIndex !== -1 && legacyIndex + 1 < segments.length) return segments[legacyIndex + 1]
        // Fallback to chatflow unik id if available
        if (chatflow?.unik_id) return chatflow.unik_id
        // Or last stored parentUnikId
        const stored = localStorage.getItem('parentUnikId')
        return stored || ''
    }
    // TODO: Persist and restore last visited sub-view (e.g. filters/tabs) of Spaces or Agentflows list when navigating back.

    const onSettingsItemClick = (setting) => {
        setSettingsOpen(false)

        if (setting === 'deleteSpace' && !isAgentCanvas) {
            // Подтверждение удаления пространства целиком
            const currentUnikId = extractUnikId()

            const title = t('confirmDeleteSpaceTitle', 'Delete Space')
            const description = t('confirmDeleteSpaceDescription', 'This will delete the space and all its canvases. This action cannot be undone.')

            confirm({ title, description }).then((confirmed) => {
                if (!confirmed) return
                deleteSpaceApi
                    .request(currentUnikId, String(spaceId))
                    .then(() => {
                        navigate(`/unik/${currentUnikId}/spaces`)
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
        } else if (setting === 'deleteCanvas') {
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
            const currentUnikId = extractUnikId()

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
        } else if (setting === 'canvasVersions') {
            if (!spaceId || !chatflow?.id) {
                enqueueSnackbar({
                    message: t('versionsDialog.saveSpaceFirst', 'Save the space before managing versions'),
                    options: { key: new Date().getTime() + Math.random(), variant: 'error' }
                })
                return
            }

            const currentUnikId = extractUnikId()
            setCanvasVersionsDialogProps({
                unikId: currentUnikId,
                spaceId: String(spaceId),
                canvasId: chatflow.id,
                canvasName: chatflow.name,
                versionLabel: chatflow.versionLabel,
                versionDescription: chatflow.versionDescription
            })
            setCanvasVersionsDialogOpen(true)
        } else if (setting === 'canvasConfiguration') {
            // Pass explicit identifiers for downstream API calls
            setCanvasConfigurationDialogProps({
                chatflow: chatflow,
                unikId: chatflow?.unik_id,
                canvasId: chatflow?.id
            })
            setCanvasConfigurationDialogOpen(true)
        } else if (setting === 'duplicateCanvas') {
            try {
                let flowData = chatflow.flowData
                const parsedFlowData = JSON.parse(flowData)
                flowData = JSON.stringify(parsedFlowData)
                localStorage.setItem('duplicatedFlowData', flowData)

                const parentUnikId = extractUnikId()
                window.open(`${uiBaseURL}/unik/${parentUnikId}/${isAgentCanvas ? 'agentcanvas' : 'spaces'}/new`, '_blank')
            } catch (e) {
                console.error(e)
            }
        } else if (setting === 'exportCanvas') {
            try {
                const flowData = JSON.parse(chatflow.flowData)
                let dataStr = JSON.stringify(generateExportFlowData(flowData), null, 2)
                //let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
                const blob = new Blob([dataStr], { type: 'application/json' })
                const dataUri = URL.createObjectURL(blob)

                // Define a clear and localized suffix for file name
                const titleSuffix = isAgentCanvas ? t('agent', 'Agent') : t('space', 'Space')
                let exportFileDefaultName = `${chatflow.name} ${titleSuffix}.json`

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
        setEditingFlowName(false)
    }, [chatflow?.name, spaceName])

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
        if (canvasConfigurationDialogOpen) {
            // Keep dialog props in sync with current chatflow
            setCanvasConfigurationDialogProps({
                chatflow,
                unikId: chatflow?.unik_id,
                canvasId: chatflow?.id
            })
        }
    }, [chatflow, spaceName, spaceId, isAgentCanvas, canvasConfigurationDialogOpen, t])

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

                                    const unikId = extractUnikId()
                                    if (unikId) {
                                        const targetPath = isAgentCanvasUrl ? `/unik/${unikId}/agentflows` : `/unik/${unikId}/spaces`
                                        navigate(targetPath)
                                    } else navigate('/', { replace: true })
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
                                    {chatflow?.versionLabel && (
                                        <Chip
                                            size='small'
                                            variant='outlined'
                                            color='primary'
                                            label={chatflow.versionLabel}
                                            sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                                        />
                                    )}
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
                key='canvasConfiguration'
                show={canvasConfigurationDialogOpen}
                dialogProps={canvasConfigurationDialogProps}
                onCancel={() => setCanvasConfigurationDialogOpen(false)}
                isAgentCanvas={isAgentCanvas}
            />
            <CanvasVersionsDialog
                show={canvasVersionsDialogOpen}
                dialogProps={canvasVersionsDialogProps}
                onCancel={() => setCanvasVersionsDialogOpen(false)}
                onRefreshCanvases={onRefreshCanvases}
                onSelectCanvas={onSelectCanvas}
                onActiveVersionChange={(canvas) => {
                    if (canvas?.id) {
                        setCanvasVersionsDialogProps((prev) => ({ ...prev, canvasId: canvas.id }))
                    }
                }}
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
    spaceLoading: PropTypes.bool,
    onRefreshCanvases: PropTypes.func,
    onSelectCanvas: PropTypes.func
}

export default CanvasHeader
