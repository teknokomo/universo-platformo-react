import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'

import type { MarketingActionHandler, MarketingHeroData, MarketingLeadHandler } from '../types'
import { MarketingActionButton, MarketingActionLink, MarketingMediaView } from './MarketingPrimitives'

const StyledBox = styled('div')(({ theme }) => ({
    alignSelf: 'center',
    width: '100%',
    height: 400,
    marginTop: theme.spacing(8),
    borderRadius: (theme.vars || theme).shape.borderRadius,
    outline: '6px solid',
    outlineColor: 'hsla(220, 25%, 80%, 0.2)',
    border: '1px solid',
    borderColor: (theme.vars || theme).palette.grey[200],
    boxShadow: '0 0 12px 8px hsla(220, 25%, 80%, 0.2)',
    overflow: 'hidden',
    backgroundColor: (theme.vars || theme).palette.background.paper,
    [theme.breakpoints.up('sm')]: {
        marginTop: theme.spacing(10),
        height: 700
    },
    ...theme.applyStyles('dark', {
        boxShadow: '0 0 24px 12px hsla(210, 100%, 25%, 0.2)',
        outlineColor: 'hsla(220, 20%, 42%, 0.1)',
        borderColor: (theme.vars || theme).palette.grey[700]
    })
}))

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export interface HeroProps {
    data: MarketingHeroData
    onAction?: MarketingActionHandler
    onLeadSubmit?: MarketingLeadHandler
}

export default function Hero({ data, onAction, onLeadSubmit }: HeroProps) {
    const { t } = useTranslation('apps')
    const [email, setEmail] = React.useState('')
    const [state, setState] = React.useState<SubmissionState>('idle')
    const [invalidEmail, setInvalidEmail] = React.useState(false)
    const lead = data.lead
    const submitLead = lead?.action && onLeadSubmit ? { lead, onLeadSubmit } : null
    const actionLead = lead?.action

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!submitLead) return

        const normalizedEmail = email.trim()
        if (!isValidEmail(normalizedEmail)) {
            setInvalidEmail(true)
            setState('idle')
            return
        }

        setInvalidEmail(false)
        setState('submitting')
        try {
            await submitLead.onLeadSubmit(normalizedEmail, 'hero')
            setState('success')
        } catch {
            setState('error')
        }
    }

    const leadControl = submitLead ? (
        <Stack
            component='form'
            noValidate
            onSubmit={handleSubmit}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{ pt: 2, width: { xs: '100%', sm: '350px' } }}
        >
            <TextField
                id='email-hero'
                name='email'
                label={submitLead.lead.label}
                type='email'
                size='small'
                variant='outlined'
                placeholder={submitLead.lead.placeholder}
                fullWidth
                required
                error={invalidEmail || state === 'error'}
                helperText={
                    invalidEmail
                        ? t('marketingPage.form.invalidEmail')
                        : state === 'error'
                        ? t('marketingPage.form.submitError')
                        : state === 'success'
                        ? t('marketingPage.form.submitted')
                        : undefined
                }
                value={email}
                onChange={(event) => {
                    setEmail(event.target.value)
                    if (invalidEmail) setInvalidEmail(false)
                }}
                slotProps={{ htmlInput: { autoComplete: 'email', inputMode: 'email' } }}
            />
            <Button
                type='submit'
                disabled={state === 'submitting'}
                variant='contained'
                color='primary'
                size='small'
                sx={{ minWidth: 'fit-content' }}
            >
                {state === 'submitting' ? t('marketingPage.form.submitting') : submitLead.lead.submitLabel}
            </Button>
        </Stack>
    ) : actionLead ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ pt: 2, width: { xs: '100%', sm: '350px' } }}>
            <MarketingActionButton
                action={actionLead}
                onAction={onAction}
                variant='contained'
                color='primary'
                size='small'
                sx={{ minWidth: 'fit-content' }}
            >
                {actionLead.label || lead?.submitLabel}
            </MarketingActionButton>
        </Stack>
    ) : null

    return (
        <Box
            id='hero'
            sx={(theme) => ({
                width: '100%',
                backgroundRepeat: 'no-repeat',
                backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 90%), transparent)',
                ...theme.applyStyles('dark', {
                    backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 16%), transparent)'
                })
            })}
        >
            <Container
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: { xs: 14, sm: 20 },
                    pb: { xs: 8, sm: 12 }
                }}
            >
                <Stack spacing={2} useFlexGap sx={{ alignItems: 'center', width: { xs: '100%', sm: '70%' } }}>
                    <Typography
                        component='h1'
                        id='hero-title'
                        variant='h1'
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: 'center',
                            textAlign: 'center',
                            fontSize: 'clamp(3rem, 10vw, 3.5rem)',
                            gap: { xs: 0, sm: 1 }
                        }}
                    >
                        {data.title}
                        {data.accent ? (
                            <Box
                                component='span'
                                sx={(theme) => ({ color: 'primary.main', ...theme.applyStyles('dark', { color: 'primary.light' }) })}
                            >
                                {data.accent}
                            </Box>
                        ) : null}
                    </Typography>
                    <Typography sx={{ textAlign: 'center', color: 'text.secondary', width: { sm: '100%', md: '80%' } }}>
                        {data.description}
                    </Typography>
                    {leadControl}
                    {lead?.termsText ? (
                        <Typography variant='caption' color='text.secondary' sx={{ textAlign: 'center' }}>
                            {lead.termsText}{' '}
                            {lead.termsAction ? (
                                <MarketingActionLink action={lead.termsAction} onAction={onAction} sx={{ color: 'primary.main' }} />
                            ) : null}
                        </Typography>
                    ) : null}
                </Stack>
                {data.media ? (
                    <StyledBox>
                        <MarketingMediaView
                            media={data.media}
                            loading='eager'
                            sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </StyledBox>
                ) : null}
            </Container>
        </Box>
    )
}
