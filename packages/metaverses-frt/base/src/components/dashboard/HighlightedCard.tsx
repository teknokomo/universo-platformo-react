import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'

export default function HighlightedCard() {
    const theme = useTheme()
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const { t } = useTranslation('metaverses')

    const handleOpenDocs = () => {
        window.open('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')
    }

    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <MenuBookRoundedIcon sx={{ mb: 1 }} />
                <Typography component='h2' variant='subtitle2' gutterBottom sx={{ fontWeight: '600' }}>
                    {t('board.documentation.title')}
                </Typography>
                <Typography sx={{ color: 'text.secondary', mb: 2 }}>
                    {t('board.documentation.description')}
                </Typography>
                <Button
                    variant='contained'
                    size='small'
                    color='primary'
                    endIcon={<OpenInNewIcon />}
                    fullWidth={isSmallScreen}
                    onClick={handleOpenDocs}
                >
                    {t('board.documentation.button')}
                </Button>
            </CardContent>
        </Card>
    )
}
