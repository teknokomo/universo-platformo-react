import { Request, Response } from 'express'
import { supabase } from '../../utils/supabase'
import logger from '../../utils/logger'

/**
 * Universo Platformo | Register a new user
 */
export const registerUser = async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        })

        if (error) return res.status(400).json({ error: error.message })

        logger.info(`User registration attempted for: ${email}`)
        res.status(201).json({ message: 'User registered successfully', data })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown registration error'
        logger.error(`Registration error: ${errorMessage}`)
        res.status(500).json({ error: errorMessage })
    }
}

/**
 * Universo Platformo | Login a user
 */
export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) return res.status(400).json({ error: error.message })

        // Store refresh token in HTTP-only cookie
        res.cookie('refresh_token', data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/',
            sameSite: 'strict'
        })

        logger.info(`User logged in: ${email}`)
        res.json({ token: data.session.access_token, user: data.user })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown login error'
        logger.error(`Login error: ${errorMessage}`)
        res.status(500).json({ error: errorMessage })
    }
}

/**
 * Universo Platformo | Logout a user
 */
export const logoutUser = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

    try {
        // Try to set session with the token if possible
        await supabase.auth.setSession({
            access_token: token,
            refresh_token: req.cookies.refresh_token || ''
        })

        const { error } = await supabase.auth.signOut()
        if (error) throw error

        // Clear refresh token cookie
        res.clearCookie('refresh_token')

        logger.info('User logged out')
        res.status(200).json({ message: 'Logged out successfully' })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown logout error'
        logger.error(`Logout error: ${errorMessage}`)
        res.status(500).json({ error: errorMessage })
    }
}

/**
 * Universo Platformo | Get current user
 */
export const getCurrentUser = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

    try {
        const { data, error } = await supabase.auth.getUser(token)

        if (error || !data.user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }

        res.json(data.user)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown user error'
        logger.error(`Get user error: ${errorMessage}`)
        res.status(401).json({ error: errorMessage })
    }
}

/**
 * Universo Platformo | Refresh authentication token
 */
export const refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refresh_token

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not found' })
    }

    try {
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
        })

        if (error) throw error

        if (!data.session) {
            throw new Error('No session returned from refresh')
        }

        // Update refresh token in cookie
        res.cookie('refresh_token', data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            path: '/',
            sameSite: 'strict'
        })

        logger.info('Token refreshed successfully')
        res.json({ accessToken: data.session.access_token })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error'
        logger.error(`Token refresh error: ${errorMessage}`)
        res.status(401).json({ error: errorMessage })
    }
}
