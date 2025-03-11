import React, { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

const Auth = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')

    const handleRegister = async (e) => {
        e.preventDefault()
        setError('')
        setInfo('')
        try {
            const { data, error } = await supabase.auth.signUp({ email, password })
            if (error) {
                setError(error.message)
            } else {
                // data.user может быть null, если требуется подтверждение по email
                setInfo('Registration successful! Check your email for confirmation.')
            }
        } catch (err) {
            setError('Registration error: ' + err.message)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setInfo('')
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                setError(error.message)
            } else if (data && data.session) {
                // Сохраняем JWT-токен в localStorage
                localStorage.setItem('token', data.session.access_token)
                setInfo('Login success! Token stored.')
                // Переход на страницу /uniks
                window.location.href = '/uniks'
            } else {
                setError('Login error: No session received')
            }
        } catch (err) {
            setError('Login error: ' + err.message)
        }
    }

    return (
        <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <h1>Авторизация</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {info && <p style={{ color: 'green' }}>{info}</p>}

            <form onSubmit={handleRegister}>
                <h3>Регистрация</h3>
                <input
                    type='email'
                    placeholder='Email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                />
                <input
                    type='password'
                    placeholder='Password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                />
                <button type='submit' style={{ width: '100%', marginBottom: 16 }}>
                    Зарегистрироваться
                </button>
            </form>

            <form onSubmit={handleLogin}>
                <h3>Вход</h3>
                <button type='submit' style={{ width: '100%' }}>
                    Войти
                </button>
            </form>
        </div>
    )
}

export default Auth
