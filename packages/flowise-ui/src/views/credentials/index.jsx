import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'
import dayjs from 'dayjs'
import { useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'

// material-ui
import { styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'
import {
    Button,
    Box,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    useTheme
} from '@mui/material'

// project imports
import { MainCard } from '@flowise/template-mui'
import { StyledButton } from '@flowise/template-mui'
import { CredentialListDialog } from '@flowise/template-mui'
import { ConfirmDialog } from '@flowise/template-mui'
import { AddEditCredentialDialog } from '@flowise/template-mui'

// API
import { api } from '@universo/api-client' // Replaced import credentialsApi from '@/api/credentials'

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'
import useConfirm from '@flowise/template-mui/hooks/useConfirm'

// utils
import { useNotifier } from '@flowise/template-mui/hooks'

// Icons
import { IconTrash, IconEdit, IconX, IconPlus } from '@tabler/icons-react'
import CredentialEmptySVG from '@flowise/template-mui/assets/images/credential_empty.svg'

// const
import { baseURL } from '@flowise/template-mui'
import { SET_COMPONENT_CREDENTIALS } from '@flowise/store'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'

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

// ==============================|| Credentials ||============================== //

const Credentials = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const dispatch = useDispatch()
    const { unikId } = useParams()
    const { t } = useTranslation('credentials')
    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showCredentialListDialog, setShowCredentialListDialog] = useState(false)
    const [credentialListDialogProps, setCredentialListDialogProps] = useState({})
    const [showSpecificCredentialDialog, setShowSpecificCredentialDialog] = useState(false)
    const [specificCredentialDialogProps, setSpecificCredentialDialogProps] = useState({})
    const [credentials, setCredentials] = useState([])
    const [componentsCredentials, setComponentsCredentials] = useState([])

    const { confirm } = useConfirm()

    const getAllCredentialsApi = useApi(() => api.credentials.getAllCredentials(unikId))
    const getAllComponentsCredentialsApi = useApi(api.credentials.getAllComponentsCredentials)

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }
    function filterCredentials(data) {
        return data.credentialName.toLowerCase().indexOf(search.toLowerCase()) > -1
    }

    const listCredential = () => {
        const dialogProp = {
            title: t('credentials.addCredential'),
            componentsCredentials
        }
        setCredentialListDialogProps(dialogProp)
        setShowCredentialListDialog(true)
    }

    const addNew = (credentialComponent) => {
        const dialogProp = {
            type: 'ADD',
            cancelButtonName: t('credentials.common.cancel'),
            confirmButtonName: t('credentials.common.add'),
            credentialComponent,
            unikId
        }
        setSpecificCredentialDialogProps(dialogProp)
        setShowSpecificCredentialDialog(true)
    }

    const edit = (credential) => {
        const dialogProp = {
            type: 'EDIT',
            cancelButtonName: t('credentials.common.cancel'),
            confirmButtonName: t('credentials.common.save'),
            data: credential,
            unikId
        }
        setSpecificCredentialDialogProps(dialogProp)
        setShowSpecificCredentialDialog(true)
    }

    const deleteCredential = async (credential) => {
        const confirmPayload = {
            title: t('credentials.common.delete'),
            description: t('credentials.deleteConfirm').replace('{name}', credential.name),
            confirmButtonName: t('credentials.common.delete'),
            cancelButtonName: t('credentials.common.cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                const deleteResp = await api.credentials.deleteCredential(unikId, credential.id)
                if (deleteResp.data) {
                    enqueueSnackbar({
                        message: t('credentials.deleteSuccess'),
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
                    message: t('credentials.deleteError', {
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

    const onCredentialSelected = (credentialComponent) => {
        setShowCredentialListDialog(false)
        addNew(credentialComponent)
    }

    const onConfirm = () => {
        setShowCredentialListDialog(false)
        setShowSpecificCredentialDialog(false)
        getAllCredentialsApi.request()
    }

    useEffect(() => {
        if (unikId) {
            getAllCredentialsApi.request()
            getAllComponentsCredentialsApi.request()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unikId])

    useEffect(() => {
        setLoading(getAllCredentialsApi.loading)
    }, [getAllCredentialsApi.loading])

    useEffect(() => {
        if (getAllCredentialsApi.data) {
            setCredentials(getAllCredentialsApi.data)
        }
    }, [getAllCredentialsApi.data])

    useEffect(() => {
        if (getAllCredentialsApi.error) {
            setError(getAllCredentialsApi.error)
        }
    }, [getAllCredentialsApi.error])

    useEffect(() => {
        if (getAllComponentsCredentialsApi.data) {
            setComponentsCredentials(getAllComponentsCredentialsApi.data)
            dispatch({ type: SET_COMPONENT_CREDENTIALS, componentsCredentials: getAllComponentsCredentialsApi.data })
        }
    }, [getAllComponentsCredentialsApi.data, dispatch])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder={t('credentials.searchPlaceholder')}
                            title={t('credentials.title')}
                        >
                            <StyledButton
                                variant='contained'
                                sx={{ borderRadius: 2, height: '100%' }}
                                onClick={listCredential}
                                startIcon={<IconPlus />}
                            >
                                {t('credentials.addCredential')}
                            </StyledButton>
                        </ViewHeader>
                        {!isLoading && credentials.length <= 0 ? (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '16vh', width: 'auto' }}
                                        src={CredentialEmptySVG}
                                        alt='CredentialEmptySVG'
                                    />
                                </Box>
                                <div>{t('credentials.noCredentialsYet')}</div>
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
                                            <StyledTableCell>{t('credentials.grid.name')}</StyledTableCell>
                                            <StyledTableCell>{t('credentials.grid.lastUpdated')}</StyledTableCell>
                                            <StyledTableCell>{t('credentials.grid.created')}</StyledTableCell>
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
                                                </StyledTableRow>
                                            </>
                                        ) : (
                                            <>
                                                {credentials.filter(filterCredentials).map((credential, index) => (
                                                    <StyledTableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                        <StyledTableCell scope='row'>
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    gap: 1
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        width: 35,
                                                                        height: 35,
                                                                        borderRadius: '50%',
                                                                        backgroundColor: customization.isDarkMode
                                                                            ? theme.palette.common.white
                                                                            : theme.palette.grey[300] + 75
                                                                    }}
                                                                >
                                                                    <img
                                                                        style={{
                                                                            width: '100%',
                                                                            height: '100%',
                                                                            padding: 5,
                                                                            objectFit: 'contain'
                                                                        }}
                                                                        alt={credential.credentialName}
                                                                        src={`${baseURL}/api/v1/components-credentials-icon/${credential.credentialName}`}
                                                                    />
                                                                </Box>
                                                                {credential.name}
                                                            </Box>
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            {dayjs(credential.updatedDate).format('MMMM Do, YYYY HH:mm:ss')}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            {dayjs(credential.createdDate).format('MMMM Do, YYYY HH:mm:ss')}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <IconButton title='Edit' color='primary' onClick={() => edit(credential)}>
                                                                <IconEdit />
                                                            </IconButton>
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <IconButton
                                                                title='Delete'
                                                                color='error'
                                                                onClick={() => deleteCredential(credential)}
                                                            >
                                                                <IconTrash />
                                                            </IconButton>
                                                        </StyledTableCell>
                                                    </StyledTableRow>
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
            <CredentialListDialog
                show={showCredentialListDialog}
                dialogProps={credentialListDialogProps}
                onCancel={() => setShowCredentialListDialog(false)}
                onCredentialSelected={onCredentialSelected}
            ></CredentialListDialog>
            <AddEditCredentialDialog
                show={showSpecificCredentialDialog}
                dialogProps={specificCredentialDialogProps}
                onCancel={() => setShowSpecificCredentialDialog(false)}
                onConfirm={onConfirm}
                setError={setError}
            ></AddEditCredentialDialog>
            <ConfirmDialog />
        </>
    )
}

export default Credentials
