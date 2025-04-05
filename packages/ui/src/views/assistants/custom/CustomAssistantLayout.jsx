import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Stack, Skeleton } from '@mui/material'

// project imports
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { baseURL, gridSpacing } from '@/store/constant'
import AssistantEmptySVG from '@/assets/images/assistant_empty.svg'
import { StyledButton } from '@/ui-component/button/StyledButton'
import AddCustomAssistantDialog from './AddCustomAssistantDialog'
import ErrorBoundary from '@/ErrorBoundary'

// API
import assistantsApi from '@/api/assistants'

// Hooks
import useApi from '@/hooks/useApi'

// icons
import { IconPlus } from '@tabler/icons-react'

// ==============================|| CustomAssistantLayout ||============================== //

const CustomAssistantLayout = () => {
    const navigate = useNavigate()
    const { unikId } = useParams()
    const { t } = useTranslation('assistants')

    const getAllAssistantsApi = useApi(assistantsApi.getAllAssistants)

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showDialog, setShowDialog] = useState(false)
    const [dialogProps, setDialogProps] = useState({})

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    const addNew = () => {
        const dialogProp = {
            title: t('assistants.custom.addNew'),
            type: 'ADD',
            cancelButtonName: t('assistants.common.cancel'),
            confirmButtonName: t('assistants.common.add'),
            unikId
        }
        setDialogProps(dialogProp)
        setShowDialog(true)
    }

    const onConfirm = (assistantId) => {
        setShowDialog(false)
        navigate(`/uniks/${unikId}/assistants/custom/${assistantId}`)
    }

    function filterAssistants(data) {
        try {
            const parsedData = JSON.parse(data.details)
            return parsedData && parsedData.name && parsedData.name.toLowerCase().indexOf(search.toLowerCase()) > -1
        } catch (error) {
            return false;
        }
    }

    const getImages = (details) => {
        try {
            const images = []
            if (details && details.chatModel && details.chatModel.name) {
                images.push(`${baseURL}/api/v1/node-icon/${details.chatModel.name}`)
            }
            return images
        } catch (error) {
            console.error('Ошибка при получении изображений:', error);
            return [];
        }
    }

    useEffect(() => {
        if (unikId) {
            getAllAssistantsApi.request('CUSTOM', unikId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unikId])

    useEffect(() => {
        if (getAllAssistantsApi.data) {
            setLoading(false)
        }
    }, [getAllAssistantsApi.data])

    useEffect(() => {
        if (getAllAssistantsApi.error) {
            console.error('Ошибка получения ассистентов:', getAllAssistantsApi.error);
            setError(getAllAssistantsApi.error)
        }
    }, [getAllAssistantsApi.error])

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 3 }}>
                        <ViewHeader
                            isBackButton={true}
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder={t('assistants.searchPlaceholder')}
                            title={t('assistants.custom.title')}
                            onBack={() => navigate(-1)}
                        >
                            <StyledButton
                                variant='contained'
                                sx={{ borderRadius: 2, height: 40 }}
                                onClick={addNew}
                                startIcon={<IconPlus />}
                            >
                                {t('assistants.common.add')}
                            </StyledButton>
                        </ViewHeader>
                        {isLoading ? (
                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                            </Box>
                        ) : (
                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                {getAllAssistantsApi.data && Array.isArray(getAllAssistantsApi.data) &&
                                    getAllAssistantsApi.data.filter(filterAssistants).map((data, index) => {
                                        try {
                                            const parsedDetails = JSON.parse(data.details);
                                            return (
                                                <ItemCard
                                                    data={{
                                                        name: parsedDetails?.name,
                                                        description: parsedDetails?.instruction
                                                    }}
                                                    images={getImages(parsedDetails)}
                                                    key={index}
                                                    onClick={() => navigate(`/uniks/${unikId}/assistants/custom/${data.id}`)}
                                                />
                                            );
                                        } catch (error) {
                                            console.error('Ошибка при рендеринге карточки ассистента:', error);
                                            return null;
                                        }
                                    })}
                            </Box>
                        )}
                        {!isLoading && (!getAllAssistantsApi.data || getAllAssistantsApi.data.length === 0) && (
                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                <Box sx={{ p: 2, height: 'auto' }}>
                                    <img
                                        style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                        src={AssistantEmptySVG}
                                        alt='AssistantEmptySVG'
                                    />
                                </Box>
                                <div>{t('assistants.noAssistantsYet', { type: 'Custom' })}</div>
                            </Stack>
                        )}
                    </Stack>
                )}
            </MainCard>
            <AddCustomAssistantDialog
                show={showDialog}
                dialogProps={dialogProps}
                onCancel={() => setShowDialog(false)}
                onConfirm={onConfirm}
                setError={setError}
            ></AddCustomAssistantDialog>
        </>
    )
}

export default CustomAssistantLayout
