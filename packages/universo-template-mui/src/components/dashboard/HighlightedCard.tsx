import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { type ReactNode } from 'react'

export type HighlightedCardProps = {
    icon: ReactNode
    title: string
    description: string
    buttonText: string
    buttonIcon?: ReactNode
    onButtonClick?: () => void
}

export default function HighlightedCard({ icon, title, description, buttonText, buttonIcon, onButtonClick }: HighlightedCardProps) {
    const theme = useTheme()
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))

    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                {icon}
                <Typography component='h2' variant='subtitle2' gutterBottom sx={{ fontWeight: '600' }}>
                    {title}
                </Typography>
                <Typography sx={{ color: 'text.secondary', mb: 2 }}>{description}</Typography>
                <Button
                    variant='contained'
                    size='small'
                    color='primary'
                    endIcon={buttonIcon}
                    fullWidth={isSmallScreen}
                    onClick={onButtonClick}
                >
                    {buttonText}
                </Button>
            </CardContent>
        </Card>
    )
}
