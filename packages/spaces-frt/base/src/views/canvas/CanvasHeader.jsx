import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@universo/i18n'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Box, ButtonBase, Typography, Stack, TextField, Button, CircularProgress, Chip } from '@mui/material'

// icons
import { IconSettings, IconChevronLeft, IconDeviceFloppy, IconPencil, IconCheck, IconX, IconCode } from '@tabler/icons-react'

// project imports
import Settings from '../settings'
import SaveCanvasDialog from '@flowise/template-mui/ui-components/dialog/SaveCanvasDialog'
import { api } from '@universo/api-client' // Replaced: import spacesApi from '../../api/spaces'
import APICodeDialog from '../canvases/APICodeDialog'
import ViewMessagesDialog from '@flowise/template-mui/ui-components/dialog/ViewMessagesDialog'
import CanvasConfigurationDialog from '@flowise/template-mui/ui-components/dialog/CanvasConfigurationDialog'
import { UpsertHistoryDialog } from '@flowise/docstore-frt'
import ViewLeadsDialog from '@flowise/template-mui/ui-components/dialog/ViewLeadsDialog'
import ExportAsTemplateDialog from '@flowise/template-mui/ui-components/dialog/ExportAsTemplateDialog'
import CanvasVersionsDialog from './CanvasVersionsDialog'

// API

// Hooks
import useApi from '../../hooks/useApi'
import useConfirm from '@flowise/template-mui/hooks/useConfirm'

// utils
import { generateExportFlowData } from '../../utils/genericHelper'
import { uiBaseURL, closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction, REMOVE_DIRTY } from '@flowise/store'

// ==============================|| CANVAS HEADER ||============================== //

const CanvasHeader = ({
    canvas,
    isAgentCanvas,
    handleSaveFlow,
    handleDeleteFlow,
    handleLoadFlow,
    spaceId,
    activeCanvasId,
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
    // Use global instance, leverage colon syntax for clarity across mixed namespace keys
    const { t } = useTranslation()

    // Defensive palette fallback: some host themes may not include `canvasHeader` extension.
    const canvasHeaderPalette = theme.palette.canvasHeader ?? {
        deployLight: theme.palette.primary?.light,
        deployDark: theme.palette.primary?.dark,
        saveLight: theme.palette.secondary?.light,
        saveDark: theme.palette.secondary?.dark,
        // Use bracket notation for numeric palette shades to avoid TS parse issues in declaration emit
        settingsLight: theme.palette.grey ? theme.palette.grey[300] : undefined,
        settingsDark: theme.palette.grey ? theme.palette.grey[700] : undefined
    }
    if (!theme.palette.canvasHeader) {
        // eslint-disable-next-line no-console
        console.warn('[CanvasHeader] Missing theme.palette.canvasHeader – using fallback colors', canvasHeaderPalette)
    }

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

    // Wrap API call to match useApi's expected signature: Promise<{ data: T }>
    const deleteSpaceApi = useApi(async (unikId, spaceId) => {
        await api.spaces.delete(unikId, spaceId)
        return { data: undefined }
    })
    const canvasState = useSelector((state) => state.canvas)

    // Helper: extract unikId from current location path (supports new singular '/unik/:unikId/...')
    const extractUnikId = () => {
        const segments = location.pathname.split('/').filter(Boolean)
        const singularIndex = segments.indexOf('unik')
        if (singularIndex !== -1 && singularIndex + 1 < segments.length) return segments[singularIndex + 1]
        // Legacy fallback (older plural pattern) just in case something still links that way
        const legacyIndex = segments.indexOf('uniks')
        if (legacyIndex !== -1 && legacyIndex + 1 < segments.length) return segments[legacyIndex + 1]
        // Fallback to canvas unik id if available
        if (canvas?.unik_id) return canvas.unik_id
        // Or last stored parentUnikId
        const stored = localStorage.getItem('parentUnikId')
        return stored || ''
    }
    // TODO: Persist and restore last visited sub-view (e.g. filters/tabs) of Spaces or Agentflows list when navigating back.

    const buildCanvasDialogContext = (overrides = {}) => {
        const currentUnikId = overrides.unikId ?? extractUnikId()
        const resolvedCanvasId = overrides.canvasId ?? canvas?.id ?? null
        const resolvedSpaceId = overrides.spaceId ?? spaceId ?? canvas?.spaceId ?? canvas?.space_id ?? null

        return {
            canvas,
            canvasId: resolvedCanvasId,
            spaceId: resolvedSpaceId ? String(resolvedSpaceId) : undefined,
            unikId: currentUnikId || canvas?.unik_id || canvas?.unikId || undefined,
            canvasApiKeyId: canvas?.apikeyid || undefined
        }
    }

    const onSettingsItemClick = async (setting) => {
        setSettingsOpen(false)

        if (setting === 'deleteSpace' && !isAgentCanvas) {
            // Подтверждение удаления пространства целиком
            const currentUnikId = extractUnikId()
            console.log('[CanvasHeader] deleteSpace: currentUnikId =', currentUnikId, ', spaceId =', spaceId)

            const title = t('canvas:confirmDeleteSpaceTitle')
            const description = t('canvas:confirmDeleteSpaceDescription')

            console.log('[CanvasHeader] Calling confirm with:', { title, description })
            const confirmed = await confirm({ title, description })
            console.log('[CanvasHeader] Confirm result:', confirmed)
            
            if (!confirmed) {
                console.log('[CanvasHeader] User cancelled deletion')
                return
            }

            console.log('[CanvasHeader] User confirmed, calling deleteSpaceApi.request')
            try {
                await deleteSpaceApi.request(currentUnikId, String(spaceId))
                console.log('[CanvasHeader] Space deleted successfully, navigating to spaces list')
                navigate(`/unik/${currentUnikId}/spaces`)
            } catch (error) {
                console.error('[CanvasHeader] Error deleting space:', error)
                enqueueSnackbar({
                    message: error?.response?.data?.error || error?.message,
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
        } else if (setting === 'deleteCanvas') {
            handleDeleteFlow()
        } else if (setting === 'viewMessages') {
            setViewMessagesDialogProps({
                title: 'View Messages',
                ...buildCanvasDialogContext()
            })
            setViewMessagesDialogOpen(true)
        } else if (setting === 'viewLeads') {
            setViewLeadsDialogProps({
                title: 'View Leads',
                ...buildCanvasDialogContext()
            })
            setViewLeadsDialogOpen(true)
        } else if (setting === 'saveAsTemplate') {
            if (canvasState.isDirty) {
                enqueueSnackbar({
                    message: t('canvas:messages.saveFirst'),
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

            // Check if canvas has an ID
            if (!canvas || !canvas.id) {
                enqueueSnackbar({
                    message: t('canvas:messages.exportError') + ' ' + title + '!',
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
                ...buildCanvasDialogContext({ unikId: currentUnikId })
            })
            setExportAsTemplateDialogOpen(true)
        } else if (setting === 'viewUpsertHistory') {
            setUpsertHistoryDialogProps({
                title: 'View Upsert History',
                ...buildCanvasDialogContext()
            })
            setUpsertHistoryDialogOpen(true)
        } else if (setting === 'canvasVersions') {
            if (!spaceId || !canvas?.id) {
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
                canvasId: canvas.id,
                canvasName: canvas.name,
                versionLabel: canvas.versionLabel,
                versionDescription: canvas.versionDescription
            })
            setCanvasVersionsDialogOpen(true)
        } else if (setting === 'canvasConfiguration') {
            // Pass explicit identifiers for downstream API calls
            setCanvasConfigurationDialogProps({
                ...buildCanvasDialogContext()
            })
            setCanvasConfigurationDialogOpen(true)
        } else if (setting === 'duplicateCanvas') {
            try {
                let flowData = canvas.flowData
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
                const flowData = JSON.parse(canvas.flowData)
                let dataStr = JSON.stringify(generateExportFlowData(flowData), null, 2)
                //let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
                const blob = new Blob([dataStr], { type: 'application/json' })
                const dataUri = URL.createObjectURL(blob)

                // Define a clear and localized suffix for file name
                const titleSuffix = isAgentCanvas ? t('agent', 'Agent') : t('space', 'Space')
                let exportFileDefaultName = `${canvas.name} ${titleSuffix}.json`

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
            const flowData = JSON.parse(canvas.flowData)
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
            const flowData = JSON.parse(canvas.flowData)
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
            canvasId: canvas.id,
            canvasApiKeyId: canvas.apikeyid,
            isFormDataRequired,
            isSessionMemory,
            isAgentCanvas
        })
        setAPIDialogOpen(true)
    }

    const onSaveChatflowClick = () => {
        // Use spaceId to determine if this is an existing space (more reliable than canvas?.id)
        // After creating a new space, canvas prop may not update immediately, but spaceId does
        if (spaceId) handleSaveFlow(flowName)
        else setFlowDialogOpen(true)
    }

    const onConfirmSaveName = (flowName) => {
        setFlowDialogOpen(false)
        handleSaveFlow(flowName)
        dispatch({ type: REMOVE_DIRTY })
    }

    useEffect(() => {
        setEditingFlowName(false)
    }, [canvas?.name, spaceName])

    useEffect(() => {
        // Avoid showing "Untitled Space" while existing space name is still loading
        const fallback = isAgentCanvas ? t('untitledAgent', 'Untitled Agent') : t('untitledSpace', 'Untitled Space')
        if (isAgentCanvas) {
            setFlowName(canvas?.name || fallback)
        } else if (spaceId) {
            // Existing space: show actual name when available, otherwise empty to avoid confusion
            setFlowName(spaceName || '')
        } else {
            // New space route: show fallback until user renames
            setFlowName(fallback)
        }

        if (canvasConfigurationDialogOpen) {
            setCanvasConfigurationDialogProps(buildCanvasDialogContext())
        }
    }, [canvas, spaceName, spaceId, isAgentCanvas, canvasConfigurationDialogOpen])

    return (
        <>
            <Stack flexDirection='row' justifyContent='space-between' sx={{ width: '100%' }}>
                <Stack flexDirection='row' sx={{ width: '100%', maxWidth: '50%' }}>
                    <Box>
                        <ButtonBase title={t('canvas:back')} sx={{ borderRadius: '50%' }}>
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
                                        {canvasState.isDirty && <strong style={{ color: theme.palette.orange.main }}>*</strong>}
                                        {spaceId && spaceName ? spaceName : flowName}
                                    </Typography>
                                    {canvas?.versionLabel && (
                                        <Chip
                                            size='small'
                                            variant='outlined'
                                            color='primary'
                                            label={canvas.versionLabel}
                                            sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                                        />
                                    )}
                                    {/* Do not show active canvas name under space title */}
                                </Stack>
                                {(spaceId || canvas?.id) && (
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
                                <ButtonBase title={t('canvas:saveName')} sx={{ borderRadius: '50%' }}>
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
                                <ButtonBase title={t('canvas:cancel')} sx={{ borderRadius: '50%' }}>
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
                    {canvas?.id && (
                        <ButtonBase title={t('canvas:publishAndExport')} sx={{ borderRadius: '50%', mr: 2 }}>
                            <Avatar
                                variant='rounded'
                                sx={{
                                    ...theme.typography.commonAvatar,
                                    ...theme.typography.mediumAvatar,
                                    transition: 'all .2s ease-in-out',
                                    background: canvasHeaderPalette.deployLight,
                                    color: canvasHeaderPalette.deployDark,
                                    '&:hover': {
                                        background: canvasHeaderPalette.deployDark,
                                        color: canvasHeaderPalette.deployLight
                                    }
                                }}
                                color='inherit'
                                onClick={onAPIDialogClick}
                            >
                                <IconCode stroke={1.5} size='1.3rem' />
                            </Avatar>
                        </ButtonBase>
                    )}
                    <ButtonBase title={t('canvas:saveFlow') + ' ' + titleLabel} sx={{ borderRadius: '50%', mr: 2 }}>
                        <Avatar
                            variant='rounded'
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                transition: 'all .2s ease-in-out',
                                background: canvasHeaderPalette.saveLight,
                                color: canvasHeaderPalette.saveDark,
                                '&:hover': {
                                    background: canvasHeaderPalette.saveDark,
                                    color: canvasHeaderPalette.saveLight
                                }
                            }}
                            color='inherit'
                            onClick={onSaveChatflowClick}
                        >
                            <IconDeviceFloppy stroke={1.5} size='1.3rem' />
                        </Avatar>
                    </ButtonBase>
                    <ButtonBase ref={settingsRef} title={t('canvas:settings')} sx={{ borderRadius: '50%' }}>
                        <Avatar
                            variant='rounded'
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                transition: 'all .2s ease-in-out',
                                background: canvasHeaderPalette.settingsLight,
                                color: canvasHeaderPalette.settingsDark,
                                '&:hover': {
                                    background: canvasHeaderPalette.settingsDark,
                                    color: canvasHeaderPalette.settingsLight
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
                canvas={canvas}
                isSettingsOpen={isSettingsOpen}
                anchorEl={settingsRef.current}
                onClose={() => setSettingsOpen(false)}
                onSettingsItemClick={onSettingsItemClick}
                onUploadFile={onUploadFile}
                isAgentCanvas={isAgentCanvas}
            />
            <SaveCanvasDialog
                show={flowDialogOpen}
                dialogProps={{
                    title: isAgentCanvas ? t('saveNewAgent','Save New Agent') : t('saveNewSpace','Save New Space'),
                    confirmButtonName: t('common:save'),
                    cancelButtonName: t('common:cancel'),
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
            <CanvasConfigurationDialog
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
    canvas: PropTypes.object,
    handleSaveFlow: PropTypes.func,
    handleDeleteFlow: PropTypes.func,
    handleLoadFlow: PropTypes.func,
    isAgentCanvas: PropTypes.bool,
    spaceId: PropTypes.string,
    activeCanvasId: PropTypes.string,
    spaceName: PropTypes.string,
    spaceLoading: PropTypes.bool,
    onRenameSpace: PropTypes.func,
    onRefreshCanvases: PropTypes.func,
    onSelectCanvas: PropTypes.func
}

export default CanvasHeader
