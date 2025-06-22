import { Request, Response } from 'express'
import { supabase } from '../../utils/supabase'
import { createClient } from '@supabase/supabase-js'
import logger from '../../utils/logger'

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    logger.error('[AUTH CONFIG] Missing Supabase configuration')
    logger.error(`[AUTH CONFIG] SUPABASE_URL: ${!!process.env.SUPABASE_URL}`)
    logger.error(`[AUTH CONFIG] SUPABASE_ANON_KEY: ${!!process.env.SUPABASE_ANON_KEY}`)
}

if (!process.env.SUPABASE_JWT_SECRET) {
    logger.error('[AUTH CONFIG] Missing SUPABASE_JWT_SECRET')
} else {
    logger.info('[AUTH CONFIG] SUPABASE_JWT_SECRET is configured')
}

logger.info(`[AUTH CONFIG] Supabase URL: ${process.env.SUPABASE_URL}`)
logger.info(`[AUTH CONFIG] Supabase Key configured: ${!!process.env.SUPABASE_ANON_KEY}`)

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

/**
 * Universo Platformo | Update user email
 */
export const updateUserEmail = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const { email } = req.body
    if (!email) {
        return res.status(400).json({ error: 'Email is required' })
    }

    try {
        // Get user ID from JWT token
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser(token)
        if (userError || !user) {
            logger.error(`Failed to get user from token: ${userError?.message}`)
            return res.status(401).json({ error: 'Invalid token' })
        }

        // Use SQL to update user email directly in auth.users table
        const { data, error } = await supabase.rpc('update_user_email', {
            user_id: user.id,
            new_email: email
        })

        if (error) {
            logger.error(`SQL error updating user email: ${error.message}`)
            return res.status(400).json({ error: error.message })
        }

        return res.status(200).json({
            message: 'Email updated successfully',
            email: email
        })
    } catch (error) {
        logger.error(`Unexpected error updating user email: ${error}`)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * Universo Platformo | Update user password
 */
export const updateUserPassword = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const { currentPassword, newPassword } = req.body

    // Validate input data
    if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' })
    }

    if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' })
    }

    try {
        // Create a new client instance with the user's token
        const userSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        })

        // Restore session to ensure auth context is passed to RPC calls
        await userSupabase.auth.setSession({
            access_token: token,
            refresh_token: '' // Not needed for single RPC
        })

        // Verify user with token first
        const {
            data: { user },
            error: userError
        } = await userSupabase.auth.getUser()

        if (userError || !user) {
            logger.error(`Failed to get user from token: ${userError?.message}`)
            return res.status(401).json({ error: 'Invalid token' })
        }

        // Use secure SQL function with authenticated client
        const { data, error } = await userSupabase.rpc('change_user_password_secure', {
            current_password: currentPassword,
            new_password: newPassword
        })

        if (error) {
            logger.error(`SQL error updating user password: ${error.message}`)

            // Handle specific errors
            if (error.message.includes('Current password is incorrect')) {
                return res.status(400).json({ error: 'Current password is incorrect' })
            }

            if (error.message.includes('must be at least 6 characters')) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' })
            }

            if (error.message.includes('cannot be empty')) {
                return res.status(400).json({ error: 'New password cannot be empty' })
            }

            return res.status(400).json({ error: error.message })
        }

        return res.status(200).json({
            message: 'Password updated successfully'
        })
    } catch (error) {
        logger.error(`Unexpected error updating user password: ${error}`)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
