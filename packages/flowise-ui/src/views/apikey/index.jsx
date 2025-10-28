import * as PropTypes from 'prop-types'
import moment from 'moment/moment'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'
import { useTranslation } from '@universo/i18n'

// material-ui
import {
    Button,
    Box,
    Chip,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Popover,
    Collapse,
    Typography
} from '@mui/material'
import TableCell, { tableCellClasses } from '@mui/material/TableCell'
import { useTheme, styled } from '@mui/material/styles'

// project imports
import { MainCard } from '@flowise/template-mui'
import { StyledButton } from '@flowise/template-mui'
import APIKeyDialog from './APIKeyDialog'
import { ConfirmDialog } from '@flowise/template-mui'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'

// API
import { api } from '@universo/api-client' // Replaced import apiKeyApi from '@/api/apikey'

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'
import useConfirm from '@flowise/template-mui/hooks/useConfirm'

// utils
import { useNotifier } from '@flowise/template-mui/hooks'

// Icons
import {
    IconTrash,
    IconEdit,
    IconCopy,
    IconChevronsUp,
    IconChevronsDown,
    IconX,
    IconPlus,
    IconEye,
    IconEyeOff,
    IconFileUpload
} from '@tabler/icons-react'
import APIEmptySVG from '@flowise/template-mui/assets/images/api_empty.svg'
import UploadJSONFileDialog from '@/views/apikey/UploadJSONFileDialog'

// ==============================|| APIKey ||============================== //

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

function APIKeyRow(props) {
    const [open, setOpen] = useState(false)
    const theme = useTheme()
    const { t } = useTranslation('api-keys')

    return (
        <>
            <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <StyledTableCell scope='row' style={{ width: '15%' }}>
                    {props.apiKey.keyName}
                </StyledTableCell>
                <StyledTableCell style={{ width: '40%' }}>
                    {props.showApiKeys.includes(props.apiKey.apiKey)
                        ? props.apiKey.apiKey
                        : `${props.apiKey.apiKey.substring(0, 2)}${'•'.repeat(18)}${props.apiKey.apiKey.substring(
                              props.apiKey.apiKey.length - 5
                          )}`}
                    <IconButton title={t('apiKeys.buttonTitles.copy')} color='success' onClick={props.onCopyClick}>
                        <IconCopy />
                    </IconButton>
                    <IconButton title={t('apiKeys.buttonTitles.show')} color='inherit' onClick={props.onShowAPIClick}>
                        {props.showApiKeys.includes(props.apiKey.apiKey) ? <IconEyeOff /> : <IconEye />}
                    </IconButton>
                    <Popover
                        open={props.open}
                        anchorEl={props.anchorEl}
                        onClose={props.onClose}
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right'
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left'
                        }}
                    >
                        <Typography variant='h6' sx={{ pl: 1, pr: 1, color: 'white', background: props.theme.palette.success.dark }}>
                            {t('apiKeys.copied')}
                        </Typography>
                    </Popover>
                </StyledTableCell>
                <StyledTableCell>
                    {props.apiKey.chatFlows.length}{' '}
                    {props.apiKey.chatFlows.length > 0 && (
                        <IconButton aria-label='expand row' size='small' color='inherit' onClick={() => setOpen(!open)}>
                            {props.apiKey.chatFlows.length > 0 && open ? <IconChevronsUp /> : <IconChevronsDown />}
                        </IconButton>
                    )}
                </StyledTableCell>
                <StyledTableCell>{moment(props.apiKey.createdAt).format('MMMM Do, YYYY')}</StyledTableCell>
                <StyledTableCell>
                    <IconButton title={t('apiKeys.buttonTitles.edit')} color='primary' onClick={props.onEditClick}>
                        <IconEdit />
                    </IconButton>
                </StyledTableCell>
                <StyledTableCell>
                    <IconButton title={t('apiKeys.buttonTitles.delete')} color='error' onClick={props.onDeleteClick}>
                        <IconTrash />
                    </IconButton>
                </StyledTableCell>
            </TableRow>
            {open && (
                <TableRow sx={{ '& td': { border: 0 } }}>
                    <StyledTableCell sx={{ p: 2 }} colSpan={6}>
                        <Collapse in={open} timeout='auto' unmountOnExit>
                            <Box sx={{ borderRadius: 2, border: 1, borderColor: theme.palette.grey[900] + 25, overflow: 'hidden' }}>
                                <Table aria-label='canvas table'>
                                    <TableHead sx={{ height: 48 }}>
                                        <TableRow>
                                            <StyledTableCell sx={{ width: '30%' }}>{t('apiKeys.canvasDetails.name')}</StyledTableCell>
                                            <StyledTableCell sx={{ width: '20%' }}>{t('apiKeys.canvasDetails.modifiedOn')}</StyledTableCell>
                                            <StyledTableCell sx={{ width: '50%' }}>{t('apiKeys.canvasDetails.category')}</StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {props.apiKey.chatFlows.map((flow, index) => (
                                            <TableRow key={index}>
                                                <StyledTableCell>{flow.flowName}</StyledTableCell>
                                                <StyledTableCell>{moment(flow.updatedDate).format('MMMM Do, YYYY')}</StyledTableCell>
                                                <StyledTableCell>
                                                    &nbsp;
                                                    {flow.category &&
                                                        flow.category
                                                            .split(';')
                                                            .map((tag, index) => (
                                                                <Chip key={index} label={tag} style={{ marginRight: 5, marginBottom: 5 }} />
                                                            ))}
                                                </StyledTableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Collapse>
                    </StyledTableCell>
                </TableRow>
            )}
        </>
    )
}

APIKeyRow.propTypes = {
    apiKey: PropTypes.any,
    showApiKeys: PropTypes.arrayOf(PropTypes.any),
    onCopyClick: PropTypes.func,
    onShowAPIClick: PropTypes.func,
    open: PropTypes.bool,
    anchorEl: PropTypes.any,
    onClose: PropTypes.func,
    theme: PropTypes.any,
    onEditClick: PropTypes.func,
    onDeleteClick: PropTypes.func
}
const APIKey = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const { unikId } = useParams()
    const { t } = useTranslation('api-keys')

    const dispatch = useDispatch()
    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [apiKeys, setAPIKeys] = useState([])
    const [anchorEl, setAnchorEl] = useState(null)
    const [showApiKeys, setShowApiKeys] = useState([])
    const openPopOver = Boolean(anchorEl)

    const [showUploadDialog, setShowUploadDialog] = useState(false)
    const [uploadDialogProps, setUploadDialogProps] = useState({})

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }
    function filterKeys(data) {
        return data.keyName.toLowerCase().indexOf(search.toLowerCase()) > -1
    }

    const { confirm } = useConfirm()

    const getAllAPIKeysApi = useApi(apiKeyApi.getAllAPIKeys)

    const onShowApiKeyClick = (apikey) => {
        const index = showApiKeys.indexOf(apikey)
        if (index > -1) {
            //showApiKeys.splice(index, 1)
            const newShowApiKeys = showApiKeys.filter(function (item) {
                return item !== apikey
            })
            setShowApiKeys(newShowApiKeys)
        } else {
            setShowApiKeys((prevkeys) => [...prevkeys, apikey])
        }
    }

    const handleClosePopOver = () => {
        setAnchorEl(null)
    }

    const addNew = () => {
        const dialogProp = {
            title: t('apiKeys.createKey'),
            type: 'ADD',
            cancelButtonName: t('apiKeys.common.cancel'),
            confirmButtonName: t('apiKeys.common.add'),
            customBtnId: 'btn_confirmAddingApiKey',
            unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const edit = (key) => {
        const dialogProp = {
            title: t('apiKeys.common.edit'),
            type: 'EDIT',
            cancelButtonName: t('apiKeys.common.cancel'),
            confirmButtonName: t('apiKeys.common.save'),
            customBtnId: 'btn_confirmEditingApiKey',
            key,
            unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const uploadDialog = () => {
        const dialogProp = {
            type: 'ADD',
            cancelButtonName: t('apiKeys.common.cancel'),
            confirmButtonName: t('apiKeys.import'),
            data: {},
            unikId
        }
        setUploadDialogProps(dialogProp)
        setShowUploadDialog(true)
    }

    const deleteKey = async (key) => {
        const confirmPayload = {
            title: t('apiKeys.common.delete'),
            description:
                key.chatFlows.length === 0
                    ? t('apiKeys.deleteToolConfirm').replace('{name}', key.keyName)
                    : `${t('apiKeys.common.delete')} ${key.keyName}? ${t('apiKeys.thereAre')} ${key.chatFlows.length} ${t('apiKeys.canvasesUsingKey')}`,
            confirmButtonName: t('apiKeys.common.delete'),
            cancelButtonName: t('apiKeys.common.cancel'),
            customBtnId: 'btn_initiateDeleteApiKey'
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                const deleteResp = await apiKeyApi.deleteAPI(unikId, key.id)
                if (deleteResp.data) {
                    enqueueSnackbar({
                        message: t('apiKeys.deleteSuccess'),
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
                enqueueSnackbar({
                    message: t('apiKeys.deleteError', { 
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
                onCancel()
            }
        }
    }

    const onConfirm = () => {
        setShowDialog(false)
        setShowUploadDialog(false)
        getAllAPIKeysApi.request(unikId)
    }

    useEffect(() => {
        if (unikId) {
            getAllAPIKeysApi.request(unikId)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unikId])

    useEffect(() => {
        setLoading(getAllAPIKeysApi.loading)
    }, [getAllAPIKeysApi.loading])

    useEffect(() => {
        if (getAllAPIKeysApi.data) {
            setAPIKeys(getAllAPIKeysApi.data)
        }
    }, [getAllAPIKeysApi.data])

    useEffect(() => {
        if (getAllAPIKeysApi.error) {
            setError(getAllAPIKeysApi.error)
        }
    }, [getAllAPIKeysApi.error])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader onSearchChange={onSearchChange} search={true} searchPlaceholder={t('apiKeys.searchPlaceholder')} title={t('apiKeys.title')}>
                            <Button
                                variant='outlined'
                                sx={{ borderRadius: 2, height: '100%' }}
                                onClick={uploadDialog}
                                startIcon={<IconFileUpload />}
                                id='btn_importApiKeys'
                            >
                                {t('apiKeys.import')}
                            </Button>
                            <StyledButton
                                variant='contained'
                                sx={{ borderRadius: 2, height: '100%' }}
                                onClick={addNew}
                                startIcon={<IconPlus />}
                                id='btn_createApiKey'
                            >
                                {t('apiKeys.createKey')}
                            </StyledButton>
                        </ViewHeader>
                        {!isLoading && apiKeys.length <= 0 ? (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                        src={APIEmptySVG}
                                        alt='APIEmptySVG'
                                    />
                                </Box>
                                <div>{t('apiKeys.noApiKeysYet')}</div>
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
                                            <StyledTableCell>{t('apiKeys.grid.keyName')}</StyledTableCell>
                                            <StyledTableCell>{t('apiKeys.grid.apiKey')}</StyledTableCell>
                                            <StyledTableCell>{t('apiKeys.grid.usage')}</StyledTableCell>
                                            <StyledTableCell>{t('apiKeys.grid.created')}</StyledTableCell>
                                            <StyledTableCell> </StyledTableCell>
                                            <StyledTableCell> </StyledTableCell>
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
                                                </StyledTableRow>
                                            </>
                                        ) : (
                                            <>
                                                {apiKeys.filter(filterKeys).map((key, index) => (
                                                    <APIKeyRow
                                                        key={index}
                                                        apiKey={key}
                                                        showApiKeys={showApiKeys}
                                                        onCopyClick={(event) => {
                                                            navigator.clipboard.writeText(key.apiKey)
                                                            setAnchorEl(event.currentTarget)
                                                            setTimeout(() => {
                                                                handleClosePopOver()
                                                            }, 1500)
                                                        }}
                                                        onShowAPIClick={() => onShowApiKeyClick(key.apiKey)}
                                                        open={openPopOver}
                                                        anchorEl={anchorEl}
                                                        onClose={handleClosePopOver}
                                                        theme={theme}
                                                        onEditClick={() => edit(key)}
                                                        onDeleteClick={() => deleteKey(key)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Stack>
                )}
            </MainCard>
            <APIKeyDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
                setError={setError}
            ></APIKeyDialog>
            {showUploadDialog && (
                <UploadJSONFileDialog
                    show={showUploadDialog}
                    dialogProps={uploadDialogProps}
                    onCancel={() => setShowUploadDialog(false)}
                    onConfirm={onConfirm}
                ></UploadJSONFileDialog>
            )}
            <ConfirmDialog />
        </>
    )
}

export default APIKey
