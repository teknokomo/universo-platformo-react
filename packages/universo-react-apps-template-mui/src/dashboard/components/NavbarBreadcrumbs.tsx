import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import { useTranslation } from 'react-i18next'

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
    margin: theme.spacing(1, 0),
    [`& .${breadcrumbsClasses.separator}`]: {
        color: (theme.vars || theme).palette.action.disabled,
        margin: 1
    },
    [`& .${breadcrumbsClasses.ol}`]: {
        alignItems: 'center'
    }
}))

export default function NavbarBreadcrumbs() {
    const { t } = useTranslation('apps')

    return (
        <StyledBreadcrumbs
            aria-label={t('runtime.breadcrumbs.label', 'Breadcrumbs')}
            separator={<NavigateNextRoundedIcon fontSize='small' />}
        >
            <Typography variant='body1'>{t('runtime.breadcrumbs.dashboard', 'Dashboard')}</Typography>
            <Typography variant='body1' sx={{ color: 'text.primary', fontWeight: 600 }}>
                {t('runtime.breadcrumbs.home', 'Home')}
            </Typography>
        </StyledBreadcrumbs>
    )
}
