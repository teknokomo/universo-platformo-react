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
    const [password, setPassword] = useState('')
    const [info, setInfo] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const updateEmail = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setInfo('')
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
            if (!res.ok) throw new Error(data.error)
            setInfo(t('emailUpdated'))
        } catch (err) {
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
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${window.location.origin}/api/v1/auth/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setInfo(t('passwordUpdated'))
            setPassword('')
        } catch (err) {
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
                        <TextField
                            label={t('email')}
                            fullWidth
                            type='email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button variant='contained' type='submit' disabled={loading}>
                            {t('updateEmail')}
                        </Button>
                    </Stack>
                </Box>
                <Box component='form' onSubmit={updatePassword}>
                    <Stack spacing={2}>
                        <TextField
                            label={t('password')}
                            fullWidth
                            type='password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
