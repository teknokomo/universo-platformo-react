import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

import type { MarketingActionHandler, MarketingFooterData, MarketingLeadHandler } from '../types'
import {
    MarketingActionButton,
    MarketingActionLink,
    MarketingIcon,
    MarketingMediaView,
    invokeMarketingAction,
    resolveMarketingAction
} from './MarketingPrimitives'
import Sitemark from './SitemarkIcon'

export interface FooterProps {
    data: MarketingFooterData
    onAction?: MarketingActionHandler
    onLeadSubmit?: MarketingLeadHandler
}

export default function Footer({ data, onAction, onLeadSubmit }: FooterProps) {
    const { t } = useTranslation('apps')
    const [email, setEmail] = React.useState('')
    const [state, setState] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
    const [invalidEmail, setInvalidEmail] = React.useState(false)
    const newsletter = data.newsletter
    const canSubmitNewsletter = Boolean(newsletter?.action && onLeadSubmit)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!newsletter?.action || !onLeadSubmit) return

        const normalizedEmail = email.trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setInvalidEmail(true)
            setState('idle')
            return
        }

        setInvalidEmail(false)
        setState('submitting')
        try {
            await onLeadSubmit(normalizedEmail, 'footer')
            setState('success')
        } catch {
            setState('error')
        }
    }

    return (
        <Container
            id='footer'
            component='footer'
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 4, sm: 8 },
                py: { xs: 8, sm: 10 },
                textAlign: { sm: 'center', md: 'left' }
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    flexWrap: { xs: 'nowrap', sm: 'wrap' },
                    width: '100%',
                    minWidth: 0,
                    justifyContent: 'space-between',
                    gap: 4
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flex: { xs: '1 1 100%', sm: '1 1 360px' },
                        flexDirection: 'column',
                        gap: 2,
                        minWidth: 0
                    }}
                >
                    {data.logo ? (
                        <MarketingMediaView
                            media={data.logo}
                            sx={{ width: 120, height: 32, objectFit: 'contain', objectPosition: { xs: 'center', md: 'left' } }}
                        />
                    ) : (
                        <Box component='span' role='img' aria-label={data.brandName} sx={{ display: 'inline-flex', width: 100 }}>
                            <Sitemark />
                        </Box>
                    )}
                    {data.description ? (
                        <Typography variant='body2' sx={{ color: 'text.secondary', maxWidth: 420 }}>
                            {data.description}
                        </Typography>
                    ) : null}
                    {newsletter?.action && canSubmitNewsletter ? (
                        <Box component='form' noValidate onSubmit={handleSubmit}>
                            <Typography variant='body2' sx={{ fontWeight: 600, mt: 1 }}>
                                {newsletter.title}
                            </Typography>
                            {newsletter.description ? (
                                <Typography variant='body2' sx={{ color: 'text.secondary', mb: 1 }}>
                                    {newsletter.description}
                                </Typography>
                            ) : null}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
                                <TextField
                                    size='small'
                                    type='email'
                                    id='marketing-footer-email'
                                    name='email'
                                    label={newsletter.label}
                                    placeholder={newsletter.placeholder}
                                    value={email}
                                    autoComplete='email'
                                    slotProps={{ htmlInput: { inputMode: 'email' } }}
                                    error={invalidEmail || state === 'error'}
                                    helperText={
                                        invalidEmail
                                            ? t('marketingPage.form.invalidEmail')
                                            : state === 'error'
                                            ? newsletter.errorMessage ?? t('marketingPage.form.submitError')
                                            : state === 'success'
                                            ? newsletter.successMessage
                                            : undefined
                                    }
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                                <Button
                                    type='submit'
                                    variant='contained'
                                    color='primary'
                                    size='small'
                                    disabled={state === 'submitting'}
                                    sx={{ flexShrink: 0 }}
                                >
                                    {state === 'submitting' ? t('marketingPage.form.submitting') : newsletter.submitLabel}
                                </Button>
                            </Stack>
                        </Box>
                    ) : newsletter?.action ? (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                {newsletter.title}
                            </Typography>
                            {newsletter.description ? (
                                <Typography variant='body2' sx={{ color: 'text.secondary', mb: 1 }}>
                                    {newsletter.description}
                                </Typography>
                            ) : null}
                            <MarketingActionButton action={newsletter.action} onAction={onAction} size='small' variant='contained'>
                                {newsletter.submitLabel}
                            </MarketingActionButton>
                        </Box>
                    ) : null}
                </Box>
                {data.groups?.map((group) =>
                    group.visible !== false ? (
                        <Box
                            key={group.semanticKey}
                            sx={{
                                display: { xs: 'none', sm: 'flex' },
                                flex: '1 1 120px',
                                minWidth: 0,
                                flexDirection: 'column',
                                gap: 1
                            }}
                        >
                            <Typography variant='body2' sx={{ fontWeight: 'medium' }}>
                                {group.title}
                            </Typography>
                            {group.links.map((link) => (
                                <MarketingActionLink key={link.semanticKey} action={link} onAction={onAction} />
                            ))}
                        </Box>
                    ) : null
                )}
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    justifyContent: 'space-between',
                    pt: { xs: 4, sm: 8 },
                    width: '100%',
                    borderTop: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction='row' spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                        {data.legalLinks?.map((link, index) => (
                            <React.Fragment key={link.semanticKey}>
                                {index > 0 ? (
                                    <Typography component='span' variant='body2' aria-hidden='true' sx={{ color: 'text.secondary' }}>
                                        •
                                    </Typography>
                                ) : null}
                                <MarketingActionLink action={link} onAction={onAction} />
                            </React.Fragment>
                        ))}
                    </Stack>
                    <Typography variant='body2' sx={{ color: 'text.secondary', mt: 1 }}>
                        {data.copyrightText.trimEnd()}
                        {data.copyrightAction ? (
                            <>
                                {' '}
                                <MarketingActionLink action={data.copyrightAction} onAction={onAction}>
                                    {data.copyrightAction.label}
                                </MarketingActionLink>{' '}
                                {new Date().getFullYear()}
                            </>
                        ) : null}
                    </Typography>
                </Box>
                <Stack
                    direction='row'
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', justifyContent: 'left', color: 'text.secondary' }}
                >
                    {data.socialLinks?.map((link) =>
                        (() => {
                            const resolved = resolveMarketingAction(link)
                            if (!resolved) return null
                            if (!link.icon) return <MarketingActionLink key={link.semanticKey} action={link} onAction={onAction} />
                            return (
                                <IconButton
                                    key={link.semanticKey}
                                    component='a'
                                    size='small'
                                    href={resolved.href}
                                    target={resolved.target}
                                    rel={resolved.rel}
                                    aria-label={link.label}
                                    onClick={(event) => invokeMarketingAction(event, link, onAction)}
                                    sx={{ color: 'inherit' }}
                                >
                                    <MarketingIcon name={link.icon} />
                                </IconButton>
                            )
                        })()
                    )}
                </Stack>
            </Box>
        </Container>
    )
}
