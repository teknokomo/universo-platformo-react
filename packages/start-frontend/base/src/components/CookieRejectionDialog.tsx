/**
 * CookieRejectionDialog - Full-screen dialog shown when user rejects cookies
 *
 * Explains that cookies are required and provides options to:
 * - Leave the site
 * - Configure browser to block cookies
 * - Deploy own instance from GitVerse/GitHub
 */
import { forwardRef } from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Slide from '@mui/material/Slide'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import type { TransitionProps } from '@mui/material/transitions'
import { IconX } from '@tabler/icons-react'
import { useTranslation } from '@universo/i18n'

const SlideTransition = forwardRef(function Transition(props: TransitionProps & { children: React.ReactElement }, ref: React.Ref<unknown>) {
    return <Slide direction='up' ref={ref} {...props} />
})

interface CookieRejectionDialogProps {
    open: boolean
    onClose: () => void
}

/**
 * Full-screen dialog explaining cookie requirements
 */
export function CookieRejectionDialog({ open, onClose }: CookieRejectionDialogProps) {
    const { t } = useTranslation('cookies')

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            slots={{
                transition: SlideTransition
            }}
            slotProps={{
                paper: {
                    sx: (theme) => ({
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.50)' : 'rgba(255, 255, 255, 0.50)',
                        backdropFilter: 'blur(10px)'
                    })
                }
            }}
        >
            <AppBar
                sx={{
                    position: 'relative',
                    backgroundColor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 1
                }}
            >
                <Toolbar>
                    <IconButton edge='start' onClick={onClose} aria-label='close'>
                        <IconX size={24} />
                    </IconButton>
                    <Typography sx={{ ml: 2, flex: 1 }} variant='h6' component='div'>
                        {t('rejection.title')}
                    </Typography>
                    <Button variant='contained' onClick={onClose}>
                        {t('rejection.closeButton')}
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth='md' sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* First paragraph - bold */}
                    <Typography variant='body1' sx={{ lineHeight: 1.8, fontWeight: 'bold' }}>
                        {t('rejection.paragraph1')}
                    </Typography>

                    <Typography variant='body1' sx={{ lineHeight: 1.8 }}>
                        {t('rejection.paragraph2')}
                    </Typography>

                    <Typography variant='body1' sx={{ lineHeight: 1.8 }}>
                        {t('rejection.paragraph3')}{' '}
                        <Link href='https://gitverse.ru/teknokomo' target='_blank' rel='noopener noreferrer' underline='hover'>
                            {t('rejection.gitVerseLink')}
                        </Link>{' '}
                        {t('rejection.orText')}{' '}
                        <Link href='https://github.com/teknokomo/' target='_blank' rel='noopener noreferrer' underline='hover'>
                            {t('rejection.gitHubLink')}
                        </Link>
                        .
                    </Typography>

                    {/* Last paragraph - bold */}
                    <Typography variant='body1' sx={{ lineHeight: 1.8, fontWeight: 'bold' }}>
                        {t('rejection.paragraph4')}{' '}
                        <Link href='/privacy' target='_blank' rel='noopener noreferrer' underline='hover'>
                            {t('rejection.privacyPolicyLink')}
                        </Link>
                        .
                    </Typography>
                </Box>
            </Container>
        </Dialog>
    )
}

export default CookieRejectionDialog
