/**
 * LegalPage - Terms of Service and Privacy Policy page component
 *
 * Displays legal document information with a link to the PDF document.
 * Supports both Terms of Service (/terms) and Privacy Policy (/privacy) pages.
 * Includes sticky footer with contact information.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { IconDownload } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'
import { StartFooter } from '../components/StartFooter'

export type LegalPageType = 'terms' | 'privacy'

interface LegalPageProps {
    type: LegalPageType
}

// PDF file paths (served from public folder)
// Currently only Russian versions available - will add EN when ready
const PDF_FILES = {
    terms: '/up-terms-ru-1.0.0-2025-12-25.pdf',
    privacy: '/up-privacy-ru-1.0.0-2025-12-25.pdf'
} as const

export function LegalPage({ type }: LegalPageProps) {
    const navigate = useNavigate()
    const { t } = useTranslation('legal')

    const content = useMemo(
        () => ({
            title: type === 'terms' ? t('termsTitle') : t('privacyTitle'),
            description: type === 'terms' ? t('termsDescription') : t('privacyDescription'),
            pdfUrl: PDF_FILES[type],
            downloadLabel: type === 'terms' ? t('downloadTerms') : t('downloadPrivacy'),
            lastUpdated: t('lastUpdated', { version: '1.0.0', date: '25.12.2025' })
        }),
        [type, t]
    )

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Container maxWidth='md' sx={{ pt: { xs: 14, sm: 14 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 }, flexGrow: 1 }}>
                {/* Hero image - aligned with onboarding completion screen */}
                <Box
                    component='img'
                    src='/background-image.jpg'
                    alt={t('imageAlt')}
                    sx={{
                        width: '100%',
                        height: { xs: 200, sm: 300, md: 400 },
                        objectFit: 'cover',
                        borderRadius: 2,
                        mb: 4
                    }}
                />

                <Typography variant='h4' component='h1' gutterBottom sx={{ fontWeight: 600 }}>
                    {content.title}
                </Typography>

                <Typography variant='body1' color='text.secondary' sx={{ mb: 2, lineHeight: 1.8 }}>
                    {content.description}
                </Typography>

                <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                    {content.lastUpdated}
                </Typography>

                {/* Document actions - centered */}
                <Box sx={{ mt: 3, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                            variant='contained'
                            startIcon={<IconDownload size={18} />}
                            component='a'
                            href={content.pdfUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            download
                        >
                            {content.downloadLabel}
                        </Button>

                        <Button variant='outlined' component='a' href={content.pdfUrl} target='_blank' rel='noopener noreferrer'>
                            {t('openInNewTab')}
                        </Button>
                    </Box>
                </Box>

                {/* Go Home button */}
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Button variant='outlined' color='primary' onClick={() => navigate('/')}>
                        {t('goHome')}
                    </Button>
                </Box>
            </Container>

            {/* Footer sticky to bottom with internal variant (dark gray text, blue hover) */}
            <StartFooter variant='internal' />
        </Box>
    )
}

// Pre-configured page components for routes
export function TermsPage() {
    return <LegalPage type='terms' />
}

export function PrivacyPage() {
    return <LegalPage type='privacy' />
}

export default LegalPage
