import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import { Card, CardContent, Stack } from '@mui/material'
import { useTheme, styled } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'

// icons
import { IconRobotFace, IconBrandOpenai, IconBrandAzure } from '@tabler/icons-react'

const cards = [
    {
        titleKey: 'assistants.custom.title',
        descriptionKey: 'assistants.custom.description',
        icon: <IconRobotFace />,
        iconText: 'Custom',
        gradient: 'linear-gradient(135deg, #fff8e14e 0%, #ffcc802f 100%)'
    },
    {
        titleKey: 'assistants.openai.title',
        descriptionKey: 'assistants.openai.description',
        icon: <IconBrandOpenai />,
        iconText: 'OpenAI',
        gradient: 'linear-gradient(135deg, #c9ffd85f 0%, #a0f0b567 100%)'
    },
    {
        titleKey: 'assistants.azure.title',
        descriptionKey: 'assistants.azure.description',
        icon: <IconBrandAzure />,
        iconText: 'Azure',
        gradient: 'linear-gradient(135deg, #c4e1ff57 0%, #80b7ff5a 100%)'
    }
]

const StyledCard = styled(Card)(({ gradient }) => ({
    height: '300px',
    background: gradient,
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
    cursor: 'pointer'
}))

const FeatureIcon = styled('div')(() => ({
    display: 'inline-flex',
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
    marginBottom: '16px',
    '& svg': {
        width: '1.2rem',
        height: '1.2rem',
        marginRight: '8px'
    }
}))

const FeatureCards = () => {
    const navigate = useNavigate()
    const { unikId } = useParams()
    const theme = useTheme()
    const { t } = useTranslation('assistants')
    const customization = useSelector((state) => state.customization)

    const onCardClick = (index) => {
        if (index === 0) navigate(`/uniks/${unikId}/assistants/custom`)
        if (index === 1) navigate(`/uniks/${unikId}/assistants/openai`)
        if (index === 2) alert(t('assistants.underDevelopment'))
    }

    return (
        <Stack
            spacing={3}
            direction='row'
            sx={{
                width: '100%',
                justifyContent: 'space-between'
            }}
        >
            {cards.map((card, index) => (
                <StyledCard
                    key={index}
                    gradient={card.gradient}
                    sx={{
                        flex: 1,
                        maxWidth: 'calc((100% - 2 * 16px) / 3)',
                        height: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: 1,
                        borderColor: theme.palette.grey[900] + 25,
                        borderRadius: 2,
                        color: customization.isDarkMode ? theme.palette.common.white : '#333333',
                        cursor: index === 2 ? 'not-allowed' : 'pointer',
                        opacity: index === 2 ? 0.6 : 1,
                        '&:hover': {
                            boxShadow: index === 2 ? 'none' : '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }
                    }}
                    onClick={() => index !== 2 && onCardClick(index)}
                >
                    <CardContent className='h-full relative z-10'>
                        <FeatureIcon>
                            {card.icon}
                            <span className='text-xs uppercase'>{card.iconText}</span>
                        </FeatureIcon>
                        <h2 className='text-2xl font-bold mb-2'>{t(card.titleKey)}</h2>
                        <p className='text-gray-600'>{t(card.descriptionKey)}</p>
                    </CardContent>
                </StyledCard>
            ))}
        </Stack>
    )
}

// ==============================|| ASSISTANTS ||============================== //

const Assistants = () => {
    const { unikId } = useParams()
    const { t } = useTranslation('assistants')

    if (!unikId) {
        console.error('Unik ID is missing in URL')
        return null
    }

    return (
        <>
            <MainCard>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader title={t('assistants.title')} />
                    <FeatureCards />
                </Stack>
            </MainCard>
        </>
    )
}

export default Assistants
