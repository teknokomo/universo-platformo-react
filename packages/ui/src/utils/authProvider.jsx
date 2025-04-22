import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { baseURL } from '@/store/constant'

/**
 * Universo Platformo | Authentication context
 * This provides authentication state and methods throughout the application.
 */
export const AuthContext = createContext()

/**
 * Hook to use the authentication context
 */
export const useAuth = () => useContext(AuthContext)

/**
 * Authentication provider component
 * Manages authentication state, token refresh, and provides auth methods
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // Check authentication on load
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token')
                if (!token) {
                    setUser(null)
                    setLoading(false)
                    return
                }

                const res = await axios.get(`${baseURL}/api/v1/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                setUser(res.data)
            } catch (error) {
                console.error('Auth check failed:', error)
                localStorage.removeItem('token')
                setUser(null)
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [])

    // Periodic token refresh to prevent expiration
    useEffect(() => {
        if (!user) return

        // Refresh the token every 50 minutes (if session lasts 1 hour)
        const refreshInterval = setInterval(async () => {
            try {
                console.log('Refreshing auth token...')
                const res = await axios.post(
                    `${baseURL}/api/v1/auth/refresh`,
                    {},
                    {
                        withCredentials: true
                    }
                )

                if (res.data.accessToken) {
                    localStorage.setItem('token', res.data.accessToken)
                }
            } catch (error) {
                console.error('Token refresh failed:', error)
            }
        }, 50 * 60 * 1000) // 50 minutes

        return () => clearInterval(refreshInterval)
    }, [user])

    // Authentication functions
    const login = async (email, password) => {
        const res = await axios.post(`${baseURL}/api/v1/auth/login`, { email, password })
        localStorage.setItem('token', res.data.token)
        setUser(res.data.user)
        return res.data
    }

    const logout = async () => {
        try {
            const token = localStorage.getItem('token')
            if (token) {
                await axios.post(
                    `${baseURL}/api/v1/auth/logout`,
                    {},
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        withCredentials: true
                    }
                )
            }
        } catch (error) {
            console.error('Logout failed:', error)
        } finally {
            localStorage.removeItem('token')
            setUser(null)
            // Redirect to auth page
            window.location.href = '/auth'
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated: !!user
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
