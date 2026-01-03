/**
 * StartFooter - Footer component for start pages
 *
 * Displays contact information with icons:
 * - Owner name (Telegram link)
 * - Email address
 * - Terms of Service link
 * - Privacy Policy link
 *
 * Responsive: horizontal on desktop, vertical on mobile
 * Supports two variants: 'guest' (white text with shadow) and 'internal' (dark gray text)
 */
import React from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import TelegramIcon from '@mui/icons-material/Telegram'
import EmailIcon from '@mui/icons-material/Email'
import ArticleIcon from '@mui/icons-material/Article'
import PolicyIcon from '@mui/icons-material/Policy'
import { useTranslation } from '@universo/i18n'

interface FooterItemProps {
    icon: React.ReactNode
    text: string
    href: string
    external?: boolean
    variant?: 'guest' | 'internal'
}

/**
 * Individual footer item with icon and text link
 */
const FooterItem: React.FC<FooterItemProps> = ({ icon, text, href, external = false, variant = 'guest' }) => {
    const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}

    const isGuest = variant === 'guest'

    return (
        <Link
            href={href}
            {...linkProps}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: isGuest ? '#fff' : 'text.secondary',
                textShadow: isGuest ? '0 2px 4px rgba(0,0,0,0.5)' : 'none',
                textDecoration: 'none',
                '& .MuiSvgIcon-root': {
                    filter: isGuest ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'none'
                },
                '&:hover': {
                    color: (theme) => (isGuest ? theme.palette.primary.light : theme.palette.primary.main),
                    transform: 'translateY(-2px)'
                },
                transition: 'all 0.2s'
            }}
        >
            {icon}
            <Typography variant='body2'>{text}</Typography>
        </Link>
    )
}

interface StartFooterProps {
    variant?: 'guest' | 'internal'
}

/**
 * StartFooter - Footer for guest and authenticated start pages
 */
export const StartFooter: React.FC<StartFooterProps> = ({ variant = 'guest' }) => {
    const { t } = useTranslation('landing')

    const footerItems: Omit<FooterItemProps, 'variant'>[] = [
        {
            icon: <TelegramIcon fontSize='small' />,
            text: t('footer.owner'),
            href: 'https://t.me/diverslaboristo',
            external: true
        },
        {
            icon: <EmailIcon fontSize='small' />,
            text: t('footer.email'),
            href: `mailto:${t('footer.email')}`,
            external: true
        },
        {
            icon: <ArticleIcon fontSize='small' />,
            text: t('footer.termsOfService'),
            href: '/terms',
            external: true
        },
        {
            icon: <PolicyIcon fontSize='small' />,
            text: t('footer.privacyPolicy'),
            href: '/privacy',
            external: true
        }
    ]

    const isGuest = variant === 'guest'

    return (
        <Box
            component='footer'
            sx={{
                pt: isGuest ? { xs: 0, sm: 0 } : { xs: 1, sm: 1 },
                pb: { xs: 0.5, sm: 0.5 },
                backgroundColor: 'transparent'
            }}
        >
            <Container>
                <Grid container spacing={2}>
                    {footerItems.map((item, index) => (
                        <Grid key={index} size={{ xs: 12, sm: 6, md: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <FooterItem {...item} variant={variant} />
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    )
}
