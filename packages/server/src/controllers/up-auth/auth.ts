import { Request, Response } from 'express'
import { supabase } from '../../utils/supabase'

export const registerUser = async (req: Request, res: Response) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    })

    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ message: 'User registered successfully', data })
}

export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) return res.status(400).json({ error: error.message })
    res.json({ token: data.session.access_token, user: data.user })
}

export const logoutUser = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

    const { error } = await supabase.auth.signOut()
    if (error) return res.status(500).json({ error: error.message })
    res.status(200).json({ message: 'Logged out successfully' })
}

export const getCurrentUser = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
    res.json(data.user)
}
