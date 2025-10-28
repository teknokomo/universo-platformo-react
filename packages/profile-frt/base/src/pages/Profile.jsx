// Universo Platformo | User profile page
import React, { useState, useEffect } from 'react'
import { useTranslation } from '@universo/i18n'
import { useAuth } from '@universo/auth-frt'
import { MainCard } from '@flowise/template-mui'
import { Box, TextField, Button, Stack, Alert, Typography, Grid, Paper, Divider } from '@mui/material'

const Profile = () => {
    const { t } = useTranslation('profile')
    const { user, getAccessToken } = useAuth()

    // Profile state
    const [profile, setProfile] = useState({
        nickname: '',
        first_name: '',
        last_name: ''
    })

    // Email and password state
    const [email, setEmail] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')

    // UI state
    const [profileError, setProfileError] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [profileSuccess, setProfileSuccess] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [profileLoading, setProfileLoading] = useState(false)
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [initialLoad, setInitialLoad] = useState(true)

    // Load profile data on component mount
    useEffect(() => {
        const loadProfile = async () => {
            if (!user?.id) return

            try {
                const token = await getAccessToken()
                const response = await fetch(`${window.location.origin}/api/v1/profile/${user.id}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.data) {
                        setProfile({
                            nickname: data.data.nickname || '',
                            first_name: data.data.first_name || '',
                            last_name: data.data.last_name || ''
                        })
                    }
                }

                setEmail(user.email || '')
            } catch (error) {
                console.error('Failed to load profile:', error)
            } finally {
                setInitialLoad(false)
            }
        }

        loadProfile()
    }, [user, getAccessToken])

    const updateProfile = async (e) => {
        e.preventDefault()

        if (!profile.nickname) {
            setProfileError(t('nicknameRequired'))
            return
        }

        setProfileError('')
        setProfileSuccess('')
        setProfileLoading(true)

        try {
            const token = await getAccessToken()
            const response = await fetch(`${window.location.origin}/api/v1/profile/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    nickname: profile.nickname,
                    first_name: profile.first_name,
                    last_name: profile.last_name
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setProfileSuccess(t('updateSuccess'))
                if (data.data) {
                    setProfile({
                        nickname: data.data.nickname || '',
                        first_name: data.data.first_name || '',
                        last_name: data.data.last_name || ''
                    })
                }
            } else {
                setProfileError(data.error || t('updateError'))
            }
        } catch (error) {
            setProfileError(t('networkError'))
        } finally {
            setProfileLoading(false)
        }
    }

    const updateEmail = async (e) => {
        e.preventDefault()
        setProfileLoading(true)
        setProfileError('')
        setProfileSuccess('')

        if (!email.trim()) {
            setProfileError(t('emailRequired'))
            setProfileLoading(false)
            return
        }

        try {
            const token = await getAccessToken()

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
                let errorMessage = t('emailUpdateFailed')
                if (data.error) {
                    errorMessage = data.error
                }
                throw new Error(errorMessage)
            }

            if (data.requiresConfirmation) {
                setProfileSuccess('Email update initiated. Please check your new email for confirmation link.')
            } else {
                setProfileSuccess(t('emailUpdated'))
            }
        } catch (err) {
            console.error('Email update error:', err)
            setProfileError(err.message)
        } finally {
            setProfileLoading(false)
        }
    }

    const updatePassword = async (e) => {
        e.preventDefault()
        setPasswordLoading(true)
        setPasswordError('')
        setPasswordSuccess('')

        // Validate fields
        if (!currentPassword.trim()) {
            setPasswordError(t('currentPasswordRequired'))
            setPasswordLoading(false)
            return
        }

        if (!newPassword.trim()) {
            setPasswordError(t('newPasswordRequired'))
            setPasswordLoading(false)
            return
        }

        if (newPassword !== confirmNewPassword) {
            setPasswordError(t('passwordsDoNotMatch'))
            setPasswordLoading(false)
            return
        }

        if (newPassword.length < 6) {
            setPasswordError(t('passwordTooShort'))
            setPasswordLoading(false)
            return
        }

        try {
            const token = await getAccessToken()

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
                let errorMessage = t('passwordUpdateFailed')

                if (data.error) {
                    if (data.error.includes('Current password is incorrect')) {
                        errorMessage = t('currentPasswordIncorrect')
                    } else if (data.error.includes('must be at least 6 characters')) {
                        errorMessage = t('passwordTooShort')
                    } else if (data.error.includes('cannot be empty')) {
                        errorMessage = t('newPasswordRequired')
                    } else {
                        errorMessage = data.error
                    }
                }

                throw new Error(errorMessage)
            }

            setPasswordSuccess(t('passwordUpdated'))
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
        } catch (err) {
            console.error('Password update error:', err)
            setPasswordError(err.message)
        } finally {
            setPasswordLoading(false)
        }
    }

    if (initialLoad) {
        return (
            <MainCard title={t('title')} sx={{ maxWidth: 800, margin: '0 auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <Typography>{t('loading')}</Typography>
                </Box>
            </MainCard>
        )
    }

    return (
        <MainCard title={t('title')} sx={{ maxWidth: 800, margin: '0 auto' }}>
            <Stack spacing={3}>
                {/* Profile Information Section */}
                <Paper elevation={1} sx={{ p: 3 }}>
                    <Typography variant='h6' gutterBottom>
                        {t('personalInfo')}
                    </Typography>

                    {profileError && (
                        <Alert severity='error' sx={{ mb: 2 }}>
                            {profileError}
                        </Alert>
                    )}
                    {profileSuccess && (
                        <Alert severity='success' sx={{ mb: 2 }}>
                            {profileSuccess}
                        </Alert>
                    )}

                    <Box component='form' onSubmit={updateProfile}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label={t('nickname')}
                                    value={profile.nickname}
                                    onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                                    disabled={profileLoading}
                                    required
                                    helperText={t('nicknameHelp')}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={t('firstName')}
                                    value={profile.first_name}
                                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                                    disabled={profileLoading}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={t('lastName')}
                                    value={profile.last_name}
                                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                                    disabled={profileLoading}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button type='submit' variant='contained' disabled={profileLoading}>
                                    {profileLoading ? t('updating') : t('updateProfile')}
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>
                </Paper>

                <Divider />

                {/* Email Section */}
                <Paper elevation={1} sx={{ p: 3 }}>
                    <Typography variant='h6' gutterBottom>
                        {t('emailSection')}
                    </Typography>

                    <Box component='form' onSubmit={updateEmail}>
                        <Stack spacing={2}>
                            <TextField
                                label={t('email')}
                                fullWidth
                                type='email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={profileLoading}
                                required
                            />
                            <Button variant='contained' type='submit' disabled={profileLoading}>
                                {profileLoading ? t('updating') : t('updateEmail')}
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                <Divider />

                {/* Password Section */}
                <Paper elevation={1} sx={{ p: 3 }}>
                    <Typography variant='h6' gutterBottom>
                        {t('passwordSection')}
                    </Typography>

                    {passwordError && (
                        <Alert severity='error' sx={{ mb: 2 }}>
                            {passwordError}
                        </Alert>
                    )}
                    {passwordSuccess && (
                        <Alert severity='success' sx={{ mb: 2 }}>
                            {passwordSuccess}
                        </Alert>
                    )}

                    <Box component='form' onSubmit={updatePassword}>
                        <Stack spacing={2}>
                            <TextField
                                label={t('currentPassword')}
                                fullWidth
                                type='password'
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={passwordLoading}
                                required
                            />
                            <TextField
                                label={t('newPassword')}
                                fullWidth
                                type='password'
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={passwordLoading}
                                required
                            />
                            <TextField
                                label={t('confirmNewPassword')}
                                fullWidth
                                type='password'
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                disabled={passwordLoading}
                                required
                            />
                            <Button variant='contained' type='submit' disabled={passwordLoading}>
                                {passwordLoading ? t('updating') : t('updatePassword')}
                            </Button>
                        </Stack>
                    </Box>
                </Paper>
            </Stack>
        </MainCard>
    )
}

export default Profile
