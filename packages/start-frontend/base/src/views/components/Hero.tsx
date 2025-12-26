/**
 * Hero - Landing page hero section
 *
 * Displays:
 * - Main heading with highlighted "all worlds" text
 * - Subtitle describing the platform
 * - "To the future" button linking to auth page
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { registerLandingI18n } from '../../i18n/register'

export default function Hero() {
    const { t, i18n } = useTranslation('landing')
    const [isReady, setIsReady] = useState(false)

    // Register landing i18n resources on mount
    useEffect(() => {
        registerLandingI18n(i18n)
        setIsReady(true)
    }, [i18n])

    // Wait for i18n to be registered
    if (!isReady) {
        return null
    }

    return (
        <Box
            id="hero"
            sx={{
                width: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Container
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    // Increased top padding for mobile to avoid header overlap
                    pt: { xs: 14, sm: 8 },
                    pb: { xs: 6, sm: 8 },
                }}
            >
                <Stack
                    spacing={4}
                    useFlexGap
                    sx={{ alignItems: 'center', width: { xs: '100%', sm: '70%' } }}
                >
                    <Typography
                        variant="h1"
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: 'center',
                            fontSize: 'clamp(3rem, 10vw, 3.5rem)',
                        }}
                    >
                        {t('hero.titlePrefix')}&nbsp;
                        <Typography
                            component="span"
                            variant="h1"
                            sx={(theme) => ({
                                fontSize: 'inherit',
                                color: 'primary.main',
                                ...theme.applyStyles('dark', {
                                    color: 'primary.light',
                                }),
                            })}
                        >
                            {t('hero.titleHighlight')}
                        </Typography>
                    </Typography>
                    <Typography
                        sx={{
                            textAlign: 'center',
                            color: 'text.primary',
                            width: { sm: '100%', md: '80%' },
                            fontSize: '1.15rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {t('hero.description')}
                    </Typography>
                    <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ pt: 4, justifyContent: 'center' }}
                    >
                        <Button
                            component={RouterLink}
                            to="/auth"
                            variant="contained"
                            color="info"
                            size="large"
                            sx={{
                                minWidth: 'fit-content',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                            }}
                        >
                            {t('hero.button')}
                        </Button>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    )
}
