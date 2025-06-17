// Universo Platformo | User profile page
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/utils/authProvider'
import MainCard from '@/ui-component/cards/MainCard'
import { Box, TextField, Button, Stack, Alert } from '@mui/material'

const Profile = () => {
    const { t } = useTranslation('profile')
    const { user } = useAuth()

    const [email, setEmail] = useState(user?.email || '')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [info, setInfo] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const updateEmail = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setInfo('')

        if (!email.trim()) {
            setError(t('emailRequired'))
            setLoading(false)
            return
        }

        try {
            const token = localStorage.getItem('token')

            const res = await fetch(`${window.location.origin}/api/v1/auth/email`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ email })
            })

            const data = await res.json()

            if (!res.ok) {
                // Map server errors to localized messages
                let errorMessage = t('emailUpdateFailed')

                if (data.error) {
                    // Add specific email error mappings if needed in the future
                    errorMessage = data.error
                }

                throw new Error(errorMessage)
            }

            if (data.requiresConfirmation) {
                setInfo('Email update initiated. Please check your new email for confirmation link.')
            } else {
                setInfo(t('emailUpdated'))
            }
        } catch (err) {
            console.error('Email update error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const updatePassword = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setInfo('')

        // Validate fields
        if (!currentPassword.trim()) {
            setError(t('currentPasswordRequired'))
            setLoading(false)
            return
        }

        if (!newPassword.trim()) {
            setError(t('newPasswordRequired'))
            setLoading(false)
            return
        }

        if (newPassword !== confirmNewPassword) {
            setError(t('passwordsDoNotMatch'))
            setLoading(false)
            return
        }

        if (newPassword.length < 6) {
            setError(t('passwordTooShort'))
            setLoading(false)
            return
        }

        try {
            const token = localStorage.getItem('token')

            const res = await fetch(`${window.location.origin}/api/v1/auth/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            })

            const data = await res.json()

            if (!res.ok) {
                // Map server errors to localized messages
                let errorMessage = t('passwordUpdateFailed')

                if (data.error) {
                    if (data.error.includes('Current password is incorrect')) {
                        errorMessage = t('currentPasswordIncorrect')
                    } else if (data.error.includes('must be at least 6 characters')) {
                        errorMessage = t('passwordTooShort')
                    } else if (data.error.includes('cannot be empty')) {
                        errorMessage = t('newPasswordRequired')
                    } else {
                        errorMessage = data.error // Keep original error if not recognized
                    }
                }

                throw new Error(errorMessage)
            }

            setInfo(t('passwordUpdated'))
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
        } catch (err) {
            console.error('Password update error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainCard title={t('title')} sx={{ maxWidth: 480, margin: '0 auto' }}>
            <Stack spacing={3}>
                {info && <Alert severity='success'>{info}</Alert>}
                {error && <Alert severity='error'>{error}</Alert>}
                <Box component='form' onSubmit={updateEmail}>
                    <Stack spacing={2}>
                        <TextField label={t('email')} fullWidth type='email' value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Button variant='contained' type='submit' disabled={loading}>
                            {t('updateEmail')}
                        </Button>
                    </Stack>
                </Box>
                <Box component='form' onSubmit={updatePassword}>
                    <Stack spacing={2}>
                        <TextField
                            label={t('currentPassword')}
                            fullWidth
                            type='password'
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                        <TextField
                            label={t('newPassword')}
                            fullWidth
                            type='password'
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                        <TextField
                            label={t('confirmNewPassword')}
                            fullWidth
                            type='password'
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            required
                        />
                        <Button variant='contained' type='submit' disabled={loading}>
                            {t('updatePassword')}
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        </MainCard>
    )
}

export default Profile
