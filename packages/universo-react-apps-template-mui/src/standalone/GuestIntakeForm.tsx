import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { SmartCaptcha } from '@yandex/smart-captcha'
import { useTranslation } from 'react-i18next'
import type { GuestSessionController } from './useGuestSession'

type GuestIntakeFormProps = {
    applicationId: string
    slug: string
    guestSession: GuestSessionController
    isValidGuestEmail: (value: string) => boolean
}

export default function GuestIntakeForm({ applicationId, slug, guestSession, isValidGuestEmail }: GuestIntakeFormProps) {
    const { t } = useTranslation('apps')
    const [captchaWidgetVersion, setCaptchaWidgetVersion] = useState(0)
    const {
        linkQuery,
        intakePolicy,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        email,
        setEmail,
        phone,
        setPhone,
        captchaToken,
        intakeSubmitted,
        termsAccepted,
        setTermsAccepted,
        privacyAccepted,
        setPrivacyAccepted,
        requiresCaptcha,
        guestCaptchaConfigQuery,
        captchaFieldRef,
        captchaMessage,
        setCaptchaToken,
        setCaptchaMessage,
        sessionMutation,
        handleStartGuestSession,
        formatGuestError
    } = guestSession

    useEffect(() => {
        if (requiresCaptcha && sessionMutation.error) {
            setCaptchaWidgetVersion((version) => version + 1)
        }
    }, [requiresCaptcha, sessionMutation.error])

    const requiredIdentityFieldsComplete =
        (!intakePolicy.requireFirstName || (intakePolicy.showFirstName && Boolean(firstName.trim()))) &&
        (!intakePolicy.requireLastName || (intakePolicy.showLastName && Boolean(lastName.trim()))) &&
        (!intakePolicy.requireEmail || (intakePolicy.showEmail && Boolean(email.trim()))) &&
        (!intakePolicy.requirePhone || (intakePolicy.showPhone && Boolean(phone.trim())))
    const optionalEmailValid = !intakePolicy.showEmail || !email.trim() || isValidGuestEmail(email.trim())
    const captchaSatisfied =
        !requiresCaptcha ||
        (guestCaptchaConfigQuery.data?.enabled === true && Boolean(guestCaptchaConfigQuery.data.siteKey?.trim()) && Boolean(captchaToken))
    const isStartDisabled =
        sessionMutation.isPending ||
        linkQuery.isLoading ||
        linkQuery.isError ||
        !linkQuery.data ||
        !requiredIdentityFieldsComplete ||
        !optionalEmailValid ||
        !termsAccepted ||
        !privacyAccepted ||
        !captchaSatisfied

    return (
        <Card>
            <Stack spacing={2}>
                <CardHeader title={linkQuery.data?.title ?? t('guest.enterNameTitle', 'Enter your name to continue')} />
                <CardContent>
                    <Box component='form' onSubmit={handleStartGuestSession} noValidate>
                        <Stack spacing={2}>
                            {linkQuery.isLoading ? (
                                <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }} role='status' aria-live='polite'>
                                    <CircularProgress size={20} />
                                    <Typography>{t('guest.loadingLink', 'Loading access link...')}</Typography>
                                </Stack>
                            ) : null}
                            {linkQuery.error ? (
                                <Alert severity='error'>
                                    {formatGuestError(
                                        linkQuery.error,
                                        'guest.errors.linkNotFound',
                                        'Access link was not found or is no longer active.'
                                    )}
                                </Alert>
                            ) : null}
                            {intakePolicy.showFirstName ? (
                                <TextField
                                    value={firstName}
                                    onChange={(event) => setFirstName(event.target.value)}
                                    label={t('guest.firstName', 'First name')}
                                    autoComplete='given-name'
                                    required={intakePolicy.requireFirstName}
                                    fullWidth
                                    error={intakeSubmitted && intakePolicy.requireFirstName && !firstName.trim()}
                                    helperText={
                                        intakeSubmitted && intakePolicy.requireFirstName && !firstName.trim()
                                            ? t('guest.errors.firstNameRequired', 'Enter your first name.')
                                            : undefined
                                    }
                                />
                            ) : null}
                            {intakePolicy.showLastName ? (
                                <TextField
                                    value={lastName}
                                    onChange={(event) => setLastName(event.target.value)}
                                    label={t('guest.lastName', 'Last name')}
                                    autoComplete='family-name'
                                    required={intakePolicy.requireLastName}
                                    fullWidth
                                    error={intakeSubmitted && intakePolicy.requireLastName && !lastName.trim()}
                                    helperText={
                                        intakeSubmitted && intakePolicy.requireLastName && !lastName.trim()
                                            ? t('guest.errors.lastNameRequired', 'Enter your last name.')
                                            : undefined
                                    }
                                />
                            ) : null}
                            {intakePolicy.showEmail ? (
                                <TextField
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    label={t('guest.email', 'Email address')}
                                    type='email'
                                    autoComplete='email'
                                    required={intakePolicy.requireEmail}
                                    fullWidth
                                    error={
                                        (intakeSubmitted && intakePolicy.requireEmail && !email.trim()) ||
                                        (Boolean(email.trim()) && !isValidGuestEmail(email.trim()))
                                    }
                                    helperText={
                                        intakeSubmitted && intakePolicy.requireEmail && !email.trim()
                                            ? t('guest.errors.emailRequired', 'Enter your email address.')
                                            : Boolean(email.trim()) && !isValidGuestEmail(email.trim())
                                            ? t('guest.errors.emailInvalid', 'Enter a valid email address.')
                                            : undefined
                                    }
                                />
                            ) : null}
                            {intakePolicy.showPhone ? (
                                <TextField
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    label={t('guest.phone', 'Phone number')}
                                    type='tel'
                                    autoComplete='tel'
                                    required={intakePolicy.requirePhone}
                                    fullWidth
                                    error={intakeSubmitted && intakePolicy.requirePhone && !phone.trim()}
                                    helperText={
                                        intakeSubmitted && intakePolicy.requirePhone && !phone.trim()
                                            ? t('guest.errors.phoneRequired', 'Enter your phone number.')
                                            : undefined
                                    }
                                />
                            ) : null}
                            <FormControl required error={intakeSubmitted && !termsAccepted}>
                                <Stack direction='row' spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Checkbox
                                        checked={termsAccepted}
                                        required
                                        onChange={(event) => setTermsAccepted(event.target.checked)}
                                        slotProps={{
                                            input: {
                                                'aria-labelledby': 'guest-terms-consent guest-terms-link',
                                                'aria-describedby': intakeSubmitted && !termsAccepted ? 'guest-terms-error' : undefined
                                            }
                                        }}
                                    />
                                    <Typography id='guest-terms-consent' component='span'>
                                        {t('guest.termsConsent', 'I agree to the')}
                                    </Typography>
                                    <Link id='guest-terms-link' href='/terms' target='_blank' rel='noopener noreferrer'>
                                        {t('guest.termsLink', 'Terms of Service')}
                                    </Link>
                                </Stack>
                                {intakeSubmitted && !termsAccepted ? (
                                    <FormHelperText id='guest-terms-error'>
                                        {t('guest.errors.termsRequired', 'Accept the Terms of Service to continue.')}
                                    </FormHelperText>
                                ) : null}
                            </FormControl>
                            <FormControl required error={intakeSubmitted && !privacyAccepted}>
                                <Stack direction='row' spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Checkbox
                                        checked={privacyAccepted}
                                        required
                                        onChange={(event) => setPrivacyAccepted(event.target.checked)}
                                        slotProps={{
                                            input: {
                                                'aria-labelledby': 'guest-privacy-consent guest-privacy-link',
                                                'aria-describedby': intakeSubmitted && !privacyAccepted ? 'guest-privacy-error' : undefined
                                            }
                                        }}
                                    />
                                    <Typography id='guest-privacy-consent' component='span'>
                                        {t('guest.privacyConsent', 'I have read the')}
                                    </Typography>
                                    <Link id='guest-privacy-link' href='/privacy' target='_blank' rel='noopener noreferrer'>
                                        {t('guest.privacyLink', 'Privacy Policy')}
                                    </Link>
                                </Stack>
                                {intakeSubmitted && !privacyAccepted ? (
                                    <FormHelperText id='guest-privacy-error'>
                                        {t('guest.errors.privacyRequired', 'Accept the Privacy Policy to continue.')}
                                    </FormHelperText>
                                ) : null}
                            </FormControl>
                            {requiresCaptcha ? (
                                <Box
                                    ref={captchaFieldRef}
                                    tabIndex={-1}
                                    role='group'
                                    aria-labelledby='guest-captcha-label'
                                    aria-describedby={captchaMessage ? 'guest-captcha-error' : undefined}
                                    sx={{ minWidth: 0 }}
                                >
                                    <Typography id='guest-captcha-label' variant='body2' sx={{ mb: 1 }}>
                                        {t('guest.captcha', 'Security verification')}
                                    </Typography>
                                    {guestCaptchaConfigQuery.isLoading ? (
                                        <Typography role='status' aria-live='polite'>
                                            {t('guest.captchaLoading', 'Loading security verification...')}
                                        </Typography>
                                    ) : guestCaptchaConfigQuery.isError ||
                                      !guestCaptchaConfigQuery.data?.enabled ||
                                      !guestCaptchaConfigQuery.data.siteKey ? (
                                        <Alert severity='error'>{t('guest.errors.captchaUnavailable', 'CAPTCHA is not available.')}</Alert>
                                    ) : (
                                        <SmartCaptcha
                                            key={`${applicationId}-${slug}-${captchaWidgetVersion}`}
                                            sitekey={guestCaptchaConfigQuery.data.siteKey}
                                            test={guestCaptchaConfigQuery.data.testMode}
                                            onSuccess={(token) => {
                                                setCaptchaToken(token)
                                                setCaptchaMessage('')
                                            }}
                                            onTokenExpired={() => {
                                                setCaptchaToken('')
                                                if (intakeSubmitted) {
                                                    setCaptchaMessage(
                                                        t('guest.errors.captchaExpired', 'The CAPTCHA expired. Complete it again.')
                                                    )
                                                }
                                            }}
                                            onNetworkError={() => {
                                                setCaptchaToken('')
                                                setCaptchaMessage(
                                                    t('guest.errors.captchaNetwork', 'CAPTCHA is temporarily unavailable. Try again.')
                                                )
                                            }}
                                        />
                                    )}
                                    {captchaMessage ? (
                                        <FormHelperText id='guest-captcha-error' error>
                                            {captchaMessage}
                                        </FormHelperText>
                                    ) : null}
                                </Box>
                            ) : null}
                            <Button type='submit' variant='contained' disabled={isStartDisabled}>
                                {sessionMutation.isPending ? t('guest.starting', 'Starting...') : t('guest.start', 'Start learning')}
                            </Button>
                            {sessionMutation.error ? (
                                <Alert severity='error'>
                                    {formatGuestError(
                                        sessionMutation.error,
                                        'guest.errors.sessionCreate',
                                        'Failed to create guest session.'
                                    )}
                                </Alert>
                            ) : null}
                        </Stack>
                    </Box>
                </CardContent>
            </Stack>
        </Card>
    )
}
