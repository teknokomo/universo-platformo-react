import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Box, Stack, Button, ButtonGroup, Skeleton, ToggleButtonGroup, ToggleButton } from '@mui/material'

// project imports
import { MainCard } from '@flowise/template-mui'
import { ItemCard } from '@flowise/template-mui'
import { gridSpacing } from '@flowise/template-mui'
import ToolEmptySVG from '@flowise/template-mui/assets/images/tools_empty.svg'
import { StyledButton } from '@flowise/template-mui'
import { ToolDialog } from '@flowise/template-mui'
import { ToolsTable } from '@flowise/template-mui'

// API
import { api } from '@universo/api-client' // Replaced import toolsApi from '@/api/tools'

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'

// icons
import { IconPlus, IconFileUpload, IconLayoutGrid, IconList } from '@tabler/icons-react'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'
import { useTheme } from '@mui/material/styles'

// ==============================|| TOOLS ||============================== //

const Tools = () => {
    const navigate = useNavigate()
    const { unikId } = useParams()
    const theme = useTheme()
    const { t } = useTranslation(['tools'])
    const getAllToolsApi = useApi(() => api.tools.getAllTools(unikId))

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})
    const [view, setView] = useState(localStorage.getItem('toolsDisplayStyle') || 'card')

    const inputRef = useRef(null)

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('toolsDisplayStyle', nextView)
        setView(nextView)
    }

    const onUploadFile = (file) => {
        try {
            const dialogProp = {
                title: t('tools.dialog.addNewTool'),
                type: 'IMPORT',
                cancelButtonName: t('tools.common.cancel'),
                confirmButtonName: t('tools.common.save'),
                data: JSON.parse(file)
            }
            setDialogProps(dialogProp)
            setShowDialog(true)
        } catch (e) {
            console.error(e)
        }
    }

    const handleFileUpload = (e) => {
        if (!e.target.files) return

        const file = e.target.files[0]

        const reader = new FileReader()
        reader.onload = (evt) => {
            if (!evt?.target?.result) {
                return
            }
            const { result } = evt.target
            onUploadFile(result)
        }
        reader.readAsText(file)
    }

    const addNew = () => {
        const dialogProp = {
            title: t('tools.dialog.addNewTool'),
            type: 'ADD',
            cancelButtonName: t('tools.common.cancel'),
            confirmButtonName: t('tools.common.add'),
            unikId: unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const edit = (selectedTool) => {
        const dialogProp = {
            title: t('tools.dialog.editTool'),
            type: 'EDIT',
            cancelButtonName: t('tools.common.cancel'),
            confirmButtonName: t('tools.common.save'),
            data: selectedTool,
            unikId: unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const onConfirm = () => {
        setShowDialog(false)
        getAllToolsApi.request()
    }

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterTools(data) {
        return (
            data.name.toLowerCase().indexOf(search.toLowerCase()) > -1 || data.description.toLowerCase().indexOf(search.toLowerCase()) > -1
        )
    }

    useEffect(() => {
        if (unikId) {
            getAllToolsApi.request()
        } else {
            console.error('Unik ID is missing in URL')
        }
    }, [unikId])

    useEffect(() => {
        setLoading(getAllToolsApi.loading)
    }, [getAllToolsApi.loading])

    useEffect(() => {
        if (getAllToolsApi.error) {
            setError(getAllToolsApi.error)
        }
    }, [getAllToolsApi.error])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader onSearchChange={onSearchChange} search={true} searchPlaceholder={t('tools.searchPlaceholder')} title={t('tools.title')}>
                            <ToggleButtonGroup
                                sx={{ borderRadius: 2, maxHeight: 40 }}
                                value={view}
                                color='primary'
                                exclusive
                                onChange={handleChange}
                            >
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='card'
                                    title={t('tools.common.cardView')}
                                >
                                    <IconLayoutGrid />
                                </ToggleButton>
                                <ToggleButton
                                    sx={{
                                        borderColor: theme.palette.grey[900] + 25,
                                        borderRadius: 2,
                                        color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                    }}
                                    variant='contained'
                                    value='list'
                                    title={t('tools.common.listView')}
                                >
                                    <IconList />
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Button
                                    variant='outlined'
                                    onClick={() => inputRef.current.click()}
                                    startIcon={<IconFileUpload />}
                                    sx={{ borderRadius: 2, height: 40 }}
                                >
                                    {t('tools.load')}
                                </Button>
                                <input
                                    style={{ display: 'none' }}
                                    ref={inputRef}
                                    type='file'
                                    hidden
                                    accept='.json'
                                    onChange={(e) => handleFileUpload(e)}
                                />
                            </Box>
                            <ButtonGroup disableElevation aria-label='outlined primary button group'>
                                <StyledButton
                                    variant='contained'
                                    onClick={addNew}
                                    startIcon={<IconPlus />}
                                    sx={{ borderRadius: 2, height: 40 }}
                                >
                                    {t('tools.create')}
                                </StyledButton>
                            </ButtonGroup>
                        </ViewHeader>
                        {!view || view === 'card' ? (
                            <>
                                {isLoading ? (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        <Skeleton variant='rounded' height={160} />
                                        <Skeleton variant='rounded' height={160} />
                                        <Skeleton variant='rounded' height={160} />
                                    </Box>
                                ) : (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        {getAllToolsApi.data &&
                                            getAllToolsApi.data
                                                ?.filter(filterTools)
                                                .map((data, index) => <ItemCard data={data} key={index} onClick={() => edit(data)} />)}
                                    </Box>
                                )}
                            </>
                        ) : (
                            <ToolsTable data={getAllToolsApi.data} isLoading={isLoading} onSelect={edit} />
                        )}
                        {!isLoading && (!getAllToolsApi.data || getAllToolsApi.data.length === 0) && (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                        src={ToolEmptySVG}
                                        alt='ToolEmptySVG'
                                    />
                                </Box>
                                <div>{t('tools.noToolsCreatedYet')}</div>
                            </Stack>
                        )}
                    </Stack>
                )}
            </MainCard>
            {showDialog && (
                <ToolDialog
                    show={showDialog}
                    dialogProps={dialogProps}
                    onCancel={() => setShowDialog(false)}
                    onConfirm={onConfirm}
                    setError={setError}
                />
            )}
        </>
    )
}

export default Tools
