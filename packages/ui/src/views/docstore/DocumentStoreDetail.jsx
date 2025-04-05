import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as PropTypes from 'prop-types'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import {
    Box,
    Stack,
    Typography,
    TableContainer,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Chip,
    Menu,
    MenuItem,
    Divider,
    Button,
    Skeleton,
    IconButton
} from '@mui/material'
import { alpha, styled, useTheme } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import AddDocStoreDialog from '@/views/docstore/AddDocStoreDialog'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import DocumentLoaderListDialog from '@/views/docstore/DocumentLoaderListDialog'
import ErrorBoundary from '@/ErrorBoundary'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import DeleteDocStoreDialog from './DeleteDocStoreDialog'
import DocumentStoreStatus from '@/views/docstore/DocumentStoreStatus'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import DocStoreAPIDialog from './DocStoreAPIDialog'

// API
import documentsApi from '@/api/documentstore'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'
import { getFileName } from '@/utils/genericHelper'
import useConfirm from '@/hooks/useConfirm'

// icons
import { IconPlus, IconRefresh, IconX, IconVectorBezier2 } from '@tabler/icons-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import FileDeleteIcon from '@mui/icons-material/Delete'
import FileEditIcon from '@mui/icons-material/Edit'
import FileChunksIcon from '@mui/icons-material/AppRegistration'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import CodeIcon from '@mui/icons-material/Code'
import doc_store_details_emptySVG from '@/assets/images/doc_store_details_empty.svg'

// store
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'

// ==============================|| DOCUMENTS ||============================== //

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    padding: '6px 16px',

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const StyledMenu = styled((props) => (
    <Menu
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
        }}
        {...props}
    />
))(({ theme }) => ({
    '& .MuiPaper-root': {
        borderRadius: 6,
        marginTop: theme.spacing(1),
        minWidth: 180,
        boxShadow:
            'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        '& .MuiMenu-list': {
            padding: '4px 0'
        },
        '& .MuiMenuItem-root': {
            '& .MuiSvgIcon-root': {
                fontSize: 18,
                color: theme.palette.text.secondary,
                marginRight: theme.spacing(1.5)
            },
            '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            }
        }
    }
}))

const DocumentStoreDetails = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { t } = useTranslation(['document-store', 'vector-store'])
    useNotifier()
    const { confirm } = useConfirm()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const getSpecificDocumentStore = useApi(documentsApi.getSpecificDocumentStore)

    const [error, setError] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [isBackdropLoading, setBackdropLoading] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [documentStore, setDocumentStore] = useState({})
    const [dialogProps, setDialogProps] = useState({})
    const [showDocumentLoaderListDialog, setShowDocumentLoaderListDialog] = useState(false)
    const [documentLoaderListDialogProps, setDocumentLoaderListDialogProps] = useState({})
    const [showDeleteDocStoreDialog, setShowDeleteDocStoreDialog] = useState(false)
    const [deleteDocStoreDialogProps, setDeleteDocStoreDialogProps] = useState({})
    const [showDocStoreAPIDialog, setShowDocStoreAPIDialog] = useState(false)
    const [docStoreAPIDialogProps, setDocStoreAPIDialogProps] = useState({})

    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)

    const { storeId, unikId } = useParams()

    const openPreviewSettings = (id) => {
        navigate(`/uniks/${unikId}/document-stores/${storeId}/${id}`)
    }

    const showStoredChunks = (id) => {
        navigate(`/uniks/${unikId}/document-stores/chunks/${storeId}/${id}`)
    }

    const showVectorStoreQuery = (id) => {
        navigate(`/uniks/${unikId}/document-stores/query/${id}`)
    }

    const onDocLoaderSelected = (docLoaderComponentName) => {
        setShowDocumentLoaderListDialog(false)
        navigate(`/uniks/${unikId}/document-stores/${storeId}/${docLoaderComponentName}`)
    }

    const showVectorStore = (id) => {
        navigate(`/uniks/${unikId}/document-stores/vector/${id}`)
    }

    const listLoaders = () => {
        const dialogProp = {
            title: t('documentStore.loaders.common.selectLoader'),
            unikId
        }
        setDocumentLoaderListDialogProps(dialogProp)
        setShowDocumentLoaderListDialog(true)
    }

    const deleteVectorStoreDataFromStore = async (storeId) => {
        try {
            await documentsApi.deleteVectorStoreDataFromStore(unikId, storeId)
        } catch (error) {
            console.error(error)
        }
    }

    const onDocStoreDelete = async (type, file, removeFromVectorStore) => {
        setBackdropLoading(true)
        setShowDeleteDocStoreDialog(false)
        if (type === 'STORE') {
            if (removeFromVectorStore) {
                await deleteVectorStoreDataFromStore(storeId)
            }
            try {
                const deleteResp = await documentsApi.deleteDocumentStore(unikId, storeId)
                setBackdropLoading(false)
                if (deleteResp.data) {
                    enqueueSnackbar({
                        message: t('documentStore.messages.storeDeleted'),
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
                    navigate(`/uniks/${unikId}/document-stores`)
                }
            } catch (error) {
                setBackdropLoading(false)
                setError(error)
                enqueueSnackbar({
                    message: t('documentStore.messages.deleteError', { 
                        error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                    }),
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
        } else if (type === 'LOADER') {
            try {
                const deleteResp = await documentsApi.deleteLoaderFromStore(unikId, storeId, file.id)
                setBackdropLoading(false)
                if (deleteResp.data) {
                    enqueueSnackbar({
                        message: t('documentStore.messages.loaderDeleted'),
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
                    onConfirm()
                }
            } catch (error) {
                setError(error)
                setBackdropLoading(false)
                enqueueSnackbar({
                    message: t('documentStore.messages.deleteError', { 
                        error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                    }),
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

    const onLoaderDelete = (file, vectorStoreConfig, recordManagerConfig) => {
        const props = {
            title: t('documentStore.deleteDialog.title'),
            description: t('documentStore.loaders.deleteDescription', { name: file.loaderName }),
            vectorStoreConfig,
            recordManagerConfig,
            type: 'LOADER',
            file
        }

        setDeleteDocStoreDialogProps(props)
        setShowDeleteDocStoreDialog(true)
    }

    const onStoreDelete = (vectorStoreConfig, recordManagerConfig) => {
        const props = {
            title: t('documentStore.deleteDialog.title'),
            description: t('documentStore.deleteDialog.description').replace('{name}', getSpecificDocumentStore.data?.name),
            vectorStoreConfig,
            recordManagerConfig,
            type: 'STORE'
        }

        setDeleteDocStoreDialogProps(props)
        setShowDeleteDocStoreDialog(true)
    }

    const onStoreRefresh = async (storeId) => {
        const confirmPayload = {
            title: t('documentStore.refreshDialog.title'),
            description: t('documentStore.refreshDialog.description'),
            confirmButtonName: t('documentStore.common.refresh'),
            cancelButtonName: t('documentStore.common.cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            setAnchorEl(null)
            setBackdropLoading(true)
            try {
                const resp = await documentsApi.refreshLoader(unikId, storeId)
                if (resp.data) {
                    enqueueSnackbar({
                        message: t('documentStore.messages.storeRefreshed'),
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
                }
                setBackdropLoading(false)
            } catch (error) {
                setBackdropLoading(false)
                enqueueSnackbar({
                    message: t('documentStore.messages.refreshError', {
                        error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                    }),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
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

    const onEditClicked = () => {
        setAnchorEl(null)
        const dialogProp = {
            title: t('documentStore.common.edit'),
            type: 'EDIT',
            cancelButtonName: t('documentStore.common.cancel'),
            confirmButtonName: t('documentStore.common.save'),
            data: {
                id: storeId,
                name: documentStore?.name,
                description: documentStore?.description
            },
            unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const onConfirm = () => {
        setShowDialog(false)
        getSpecificDocumentStore.request(unikId, storeId)
    }

    const handleClick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        setAnchorEl(event.currentTarget)
    }

    const onViewUpsertAPI = (storeId, loaderId) => {
        const props = {
            title: `Upsert API`,
            storeId,
            loaderId
        }
        setDocStoreAPIDialogProps(props)
        setShowDocStoreAPIDialog(true)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    useEffect(() => {
        getSpecificDocumentStore.request(unikId, storeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (getSpecificDocumentStore.data) {
            setDocumentStore(getSpecificDocumentStore.data)
            // total the chunks and chars
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificDocumentStore.data])

    useEffect(() => {
        if (getSpecificDocumentStore.error) {
            setError(getSpecificDocumentStore.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificDocumentStore.error])

    useEffect(() => {
        setLoading(getSpecificDocumentStore.loading)
    }, [getSpecificDocumentStore.loading])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            isBackButton={true}
                            isEditButton={true}
                            search={false}
                            title={documentStore?.name}
                            description={documentStore?.description}
                            onBack={() => navigate(`/uniks/${unikId}/document-stores`)}
                            onEdit={() => onEditClicked()}
                        >
                            {(documentStore?.status === 'STALE' || documentStore?.status === 'UPSERTING') && (
                                <IconButton onClick={onConfirm} size='small' color='primary' title='Refresh Document Store'>
                                    <IconRefresh />
                                </IconButton>
                            )}
                            <StyledButton
                                variant='contained'
                                sx={{ ml: 2, minWidth: 200, borderRadius: 2, height: '100%', color: 'white' }}
                                startIcon={<IconPlus />}
                                onClick={listLoaders}
                            >
                                {t('documentStore.addDocumentLoader')}
                            </StyledButton>
                            <Button
                                id='document-store-header-action-button'
                                aria-controls={open ? 'document-store-header-menu' : undefined}
                                aria-haspopup='true'
                                aria-expanded={open ? 'true' : undefined}
                                variant='outlined'
                                disableElevation
                                color='secondary'
                                onClick={handleClick}
                                sx={{ minWidth: 150 }}
                                endIcon={<KeyboardArrowDownIcon />}
                            >
                                {t('documentStore.moreActions')}
                            </Button>
                            <StyledMenu
                                id='document-store-header-menu'
                                MenuListProps={{
                                    'aria-labelledby': 'document-store-header-menu-button'
                                }}
                                anchorEl={anchorEl}
                                open={open}
                                onClose={handleClose}
                            >
                                <MenuItem
                                    disabled={documentStore?.totalChunks <= 0 || documentStore?.status === 'UPSERTING'}
                                    onClick={() => showStoredChunks('all')}
                                    disableRipple
                                >
                                    <FileChunksIcon />
                                    {t('documentStore.actions.viewEditChunks')}
                                </MenuItem>
                                <MenuItem
                                    disabled={documentStore?.totalChunks <= 0 || documentStore?.status === 'UPSERTING'}
                                    onClick={() => showVectorStore(documentStore.id)}
                                    disableRipple
                                >
                                    <NoteAddIcon />
                                    {t('documentStore.actions.upsertAllChunks')}
                                </MenuItem>
                                <MenuItem
                                    disabled={documentStore?.totalChunks <= 0 || documentStore?.status !== 'UPSERTED'}
                                    onClick={() => showVectorStoreQuery(documentStore.id)}
                                    disableRipple
                                >
                                    <SearchIcon />
                                    {t('documentStore.actions.retrievalQuery')}
                                </MenuItem>
                                <MenuItem
                                    disabled={documentStore?.totalChunks <= 0 || documentStore?.status !== 'UPSERTED'}
                                    onClick={() => onStoreRefresh(documentStore.id)}
                                    disableRipple
                                    title={t('documentStore.actions.refresh')}
                                >
                                    <RefreshIcon />
                                    {t('documentStore.actions.refresh')}
                                </MenuItem>
                                <Divider sx={{ my: 0.5 }} />
                                <MenuItem
                                    onClick={() => onStoreDelete(documentStore.vectorStoreConfig, documentStore.recordManagerConfig)}
                                    disableRipple
                                >
                                    <FileDeleteIcon />
                                    {t('documentStore.actions.delete')}
                                </MenuItem>
                            </StyledMenu>
                        </ViewHeader>
                        <DocumentStoreStatus status={documentStore?.status} />
                        {getSpecificDocumentStore.data?.whereUsed?.length > 0 && (
                            <Stack flexDirection='row' sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div
                                    style={{
                                        paddingLeft: '15px',
                                        paddingRight: '15px',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        fontSize: '0.9rem',
                                        width: 'max-content',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}
                                >
                                    <IconVectorBezier2 style={{ marginRight: 5 }} size={17} />
                                    {t('documentStore.detail.chatflowsUsed')}
                                </div>
                                {getSpecificDocumentStore.data.whereUsed.map((chatflowUsed, index) => (
                                    <Chip
                                        key={index}
                                        clickable
                                        style={{
                                            width: 'max-content',
                                            borderRadius: '25px',
                                            boxShadow: customization.isDarkMode
                                                ? '0 2px 14px 0 rgb(255 255 255 / 10%)'
                                                : '0 2px 14px 0 rgb(32 40 45 / 10%)'
                                        }}
                                        label={chatflowUsed.name}
                                        onClick={() => navigate('/canvas/' + chatflowUsed.id)}
                                    ></Chip>
                                ))}
                            </Stack>
                        )}
                        {!isLoading && documentStore && !documentStore?.loaders?.length ? (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '16vh', width: 'auto' }}
                                        src={doc_store_details_emptySVG}
                                        alt='doc_store_details_emptySVG'
                                    />
                                </Box>
                                <div>{t('documentStore.noDocumentAddedYet')}</div>
                                <StyledButton
                                    variant='contained'
                                    sx={{ borderRadius: 2, height: '100%', mt: 2, color: 'white' }}
                                    startIcon={<IconPlus />}
                                    onClick={listLoaders}
                                >
                                    {t('documentStore.addDocumentLoader')}
                                </StyledButton>
                            </Stack>
                        ) : (
                            <TableContainer
                                sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                                component={Paper}
                            >
                                <Table sx={{ minWidth: 650 }} aria-label='simple table'>
                                    <TableHead
                                        sx={{
                                            backgroundColor: customization.isDarkMode
                                                ? theme.palette.common.black
                                                : theme.palette.grey[100],
                                            height: 56
                                        }}
                                    >
                                        <TableRow>
                                            <StyledTableCell>&nbsp;</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.loader')}</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.splitter')}</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.sources')}</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.chunks')}</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.chars')}</StyledTableCell>
                                            <StyledTableCell>{t('documentStore.table.actions')}</StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {isLoading ? (
                                            <>
                                                <StyledTableRow>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                                <StyledTableRow>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                            </>
                                        ) : (
                                            <>
                                                {documentStore?.loaders &&
                                                    documentStore?.loaders.length > 0 &&
                                                    documentStore?.loaders.map((loader, index) => (
                                                        <LoaderRow
                                                            key={index}
                                                            index={index}
                                                            loader={loader}
                                                            theme={theme}
                                                            onEditClick={() => openPreviewSettings(loader.id)}
                                                            onViewChunksClick={() => showStoredChunks(loader.id)}
                                                            onDeleteClick={() =>
                                                                onLoaderDelete(
                                                                    loader,
                                                                    documentStore?.vectorStoreConfig,
                                                                    documentStore?.recordManagerConfig
                                                                )
                                                            }
                                                            onChunkUpsert={() =>
                                                                navigate(`/uniks/${unikId}/document-stores/vector/${documentStore.id}/${loader.id}`)
                                                            }
                                                            onViewUpsertAPI={() => onViewUpsertAPI(documentStore.id, loader.id)}
                                                        />
                                                    ))}
                                            </>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                        {getSpecificDocumentStore.data?.status === 'STALE' && (
                            <div style={{ width: '100%', textAlign: 'center', marginTop: '20px' }}>
                                <Typography
                                    color='warning'
                                    style={{ color: 'darkred', fontWeight: 500, fontStyle: 'italic', fontSize: 12 }}
                                >
                                    {t('documentStore.detail.someFilesPendingProcessing')}
                                </Typography>
                            </div>
                        )}
                    </Stack>
                )}
            </MainCard>
            {showDialog && (
                <AddDocStoreDialog
                    dialogProps={dialogProps}
                    show={showDialog}
                    onCancel={() => setShowDialog(false)}
                    onConfirm={onConfirm}
                />
            )}
            {showDocumentLoaderListDialog && (
                <DocumentLoaderListDialog
                    show={showDocumentLoaderListDialog}
                    dialogProps={documentLoaderListDialogProps}
                    onCancel={() => setShowDocumentLoaderListDialog(false)}
                    onDocLoaderSelected={onDocLoaderSelected}
                />
            )}
            {showDeleteDocStoreDialog && (
                <DeleteDocStoreDialog
                    show={showDeleteDocStoreDialog}
                    dialogProps={deleteDocStoreDialogProps}
                    onCancel={() => setShowDeleteDocStoreDialog(false)}
                    onDelete={onDocStoreDelete}
                />
            )}
            {showDocStoreAPIDialog && (
                <DocStoreAPIDialog
                    show={showDocStoreAPIDialog}
                    dialogProps={docStoreAPIDialogProps}
                    onCancel={() => setShowDocStoreAPIDialog(false)}
                />
            )}
            {isBackdropLoading && <BackdropLoader open={isBackdropLoading} />}
            <ConfirmDialog />
        </>
    )
}

function LoaderRow(props) {
    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)
    const { t } = useTranslation(['document-store', 'vector-store'])

    const handleClick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const formatSources = (source) => {
        if (source && typeof source === 'string' && source.includes('base64')) {
            return getFileName(source)
        }
        if (source && typeof source === 'string' && source.startsWith('[') && source.endsWith(']')) {
            return JSON.parse(source).join(', ')
        }
        return source
    }

    return (
        <>
            <TableRow hover key={props.index} sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }}>
                <StyledTableCell onClick={props.onViewChunksClick} scope='row' style={{ width: '5%' }}>
                    <div
                        style={{
                            display: 'flex',
                            width: '20px',
                            height: '20px',
                            backgroundColor: props.loader?.status === 'SYNC' ? '#00e676' : '#ffe57f',
                            borderRadius: '50%'
                        }}
                    ></div>
                </StyledTableCell>
                <StyledTableCell onClick={props.onViewChunksClick} scope='row'>
                    {props.loader.loaderName}
                </StyledTableCell>
                <StyledTableCell onClick={props.onViewChunksClick}>{props.loader.splitterName ?? 'None'}</StyledTableCell>
                <StyledTableCell onClick={props.onViewChunksClick}>{formatSources(props.loader.source)}</StyledTableCell>
                <StyledTableCell onClick={props.onViewChunksClick}>
                    {props.loader.totalChunks && <Chip variant='outlined' size='small' label={props.loader.totalChunks.toLocaleString()} />}
                </StyledTableCell>
                <StyledTableCell onClick={props.onViewChunksClick}>
                    {props.loader.totalChars && <Chip variant='outlined' size='small' label={props.loader.totalChars.toLocaleString()} />}
                </StyledTableCell>
                <StyledTableCell>
                    <div>
                        <Button
                            id='document-store-action-button'
                            aria-controls={open ? 'document-store-action-customized-menu' : undefined}
                            aria-haspopup='true'
                            aria-expanded={open ? 'true' : undefined}
                            disableElevation
                            onClick={(e) => handleClick(e)}
                            endIcon={<KeyboardArrowDownIcon />}
                        >
                            {t('documentStore.actions.options')}
                        </Button>
                        <StyledMenu
                            id='document-store-actions-customized-menu'
                            MenuListProps={{
                                'aria-labelledby': 'document-store-actions-customized-button'
                            }}
                            anchorEl={anchorEl}
                            open={open}
                            onClose={handleClose}
                        >
                            <MenuItem onClick={props.onEditClick} disableRipple>
                                <FileEditIcon />
                                {t('documentStore.actions.previewProcess')}
                            </MenuItem>
                            <MenuItem onClick={props.onViewChunksClick} disableRipple>
                                <FileChunksIcon />
                                {t('documentStore.actions.viewEditChunks')}
                            </MenuItem>
                            <MenuItem onClick={props.onChunkUpsert} disableRipple>
                                <NoteAddIcon />
                                {t('documentStore.actions.upsertChunks')}
                            </MenuItem>
                            <MenuItem onClick={props.onViewUpsertAPI} disableRipple>
                                <CodeIcon />
                                {t('documentStore.actions.viewAPI')}
                            </MenuItem>
                            <Divider sx={{ my: 0.5 }} />
                            <MenuItem onClick={props.onDeleteClick} disableRipple>
                                <FileDeleteIcon />
                                {t('documentStore.actions.delete')}
                            </MenuItem>
                        </StyledMenu>
                    </div>
                </StyledTableCell>
            </TableRow>
        </>
    )
}

LoaderRow.propTypes = {
    loader: PropTypes.any,
    index: PropTypes.number,
    open: PropTypes.bool,
    theme: PropTypes.any,
    onViewChunksClick: PropTypes.func,
    onEditClick: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onChunkUpsert: PropTypes.func,
    onViewUpsertAPI: PropTypes.func
}
export default DocumentStoreDetails
