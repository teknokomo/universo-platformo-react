import { FormEvent, useState } from 'react'
import type { AuthClient } from '../api/client'
import type { AuthUser } from '../hooks/useSession'

export interface LoginFormLabels {
    email?: string
    password?: string
    submit?: string
    submitting?: string
}

export interface LoginFormProps {
    client: AuthClient
    onSuccess?: (user: AuthUser) => void
    onError?: (message: string) => void
    labels?: LoginFormLabels
}

export const LoginForm = ({ client, onSuccess, onError, labels }: LoginFormProps) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const emailLabel = labels?.email ?? 'Email'
    const passwordLabel = labels?.password ?? 'Password'
    const submitLabel = labels?.submit ?? 'Sign in'
    const submittingLabel = labels?.submitting ?? 'Signing in…'

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSubmitting(true)
        setError(null)

        try {
            const { data } = await client.post<{ user: AuthUser }>('auth/login', { email, password })
            onSuccess?.(data.user)
        } catch (err: any) {
            const message = err?.response?.data?.error ?? err?.message ?? 'Login failed'
            setError(message)
            onError?.(message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{emailLabel}</span>
                <input
                    type='email'
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete='email'
                    required
                    disabled={submitting}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d0d5dd' }}
                />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{passwordLabel}</span>
                <input
                    type='password'
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete='current-password'
                    required
                    disabled={submitting}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d0d5dd' }}
                />
            </label>

            <button
                type='submit'
                disabled={submitting}
                style={{
                    background: '#111827',
                    color: '#ffffff',
                    borderRadius: 6,
                    padding: '10px 12px',
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                }}
            >
                {submitting ? submittingLabel : submitLabel}
            </button>

            {error ? (
                <div role='alert' style={{ color: '#b91c1c', fontSize: 14 }}>
                    {error}
                </div>
            ) : null}
        </form>
    )
}

export default LoginForm
