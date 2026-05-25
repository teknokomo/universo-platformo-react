/**
 * CookieConsentBanner - Non-modal cookie consent banner (GDPR compliant)
 *
 * Fixed to bottom of screen, appears when user hasn't made a choice yet.
 * Based on MUI non-modal dialog pattern.
 */
import { useState } from 'react'
import Button from '@mui/material/Button'
import Fade from '@mui/material/Fade'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { useTranslation } from '@universo/i18n'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { CookieRejectionDialog } from './CookieRejectionDialog'

/**
 * Cookie consent banner component
 * Shows at the bottom of the page when consent is pending
 */
export function CookieConsentBanner() {
    const { t } = useTranslation('cookies')
    const { showBanner, acceptCookies, dismissTemporarily } = useCookieConsent()
    const [showRejectionDialog, setShowRejectionDialog] = useState(false)

    const handleAccept = () => {
        acceptCookies()
    }

    const handleReject = () => {
        setShowRejectionDialog(true)
    }

    const handleRejectionDialogClose = () => {
        setShowRejectionDialog(false)
        // Temporarily dismiss banner until page reload (don't save to localStorage)
        dismissTemporarily()
    }

    return (
        <>
            <Fade appear={false} in={showBanner && !showRejectionDialog}>
                <Paper
                    role='region'
                    aria-label={t('banner.title')}
                    square
                    variant='outlined'
                    tabIndex={-1}
                    sx={(theme) => ({
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        m: 0,
                        p: 2,
                        borderWidth: 0,
                        borderTopWidth: 1,
                        zIndex: 1300,
                        backgroundColor: alpha(theme.palette.background.paper, 0.55),
                        backdropFilter: 'blur(10px)'
                    })}
                >
                    {/* Title row */}
                    <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('banner.title')}</Typography>

                    {/* Content row: text + buttons on same line for desktop */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                        <Typography variant='body2' sx={{ flexShrink: 1 }}>
                            {t('banner.description')}{' '}
                            <Link href='/privacy' target='_blank' rel='noopener noreferrer' underline='hover'>
                                {t('banner.privacyPolicyLink')}
                            </Link>
                            .
                        </Typography>
                        <Stack
                            direction='row'
                            sx={{
                                gap: 2,
                                flexShrink: 0
                            }}
                        >
                            <Button size='small' onClick={handleAccept} variant='contained'>
                                {t('banner.acceptButton')}
                            </Button>
                            <Button size='small' onClick={handleReject} variant='outlined'>
                                {t('banner.rejectButton')}
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Fade>

            <CookieRejectionDialog open={showRejectionDialog} onClose={handleRejectionDialogClose} />
        </>
    )
}
