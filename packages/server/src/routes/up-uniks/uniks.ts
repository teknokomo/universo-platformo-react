import { Router, Request, Response } from 'express'
import { getSupabaseClientWithAuth } from '../../utils/supabase'
import chatflowsRouter from '../chatflows'
import chatflowsStreamingRouter from '../chatflows-streaming'
import chatflowsUploadsRouter from '../chatflows-uploads'
import flowConfigRouter from '../flow-config'
import toolsRouter from '../tools'
import variablesRouter from '../variables'
import exportImportRouter from '../export-import'
import credentialsRouter from '../credentials'
import assistantsRouter from '../assistants'
import apikeyRouter from '../apikey'
import documentStoreRouter from '../documentstore'
import marketplacesRouter from '../marketplaces'
import upAuth from '../../middlewares/up-auth'

const router = Router()

// GET /uniks — Get list of Uniks for current user through user_uniks table
router.get('/', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const { data: user, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }
        const userId = user.user.id
        const { data, error } = await supabaseClient.from('user_uniks').select('role, unik:uniks(*)').eq('user_id', userId)
        if (error) {
            return res.status(500).json({ error: error.message })
        }
        const uniks = data.map((item: any) => ({
            ...item.unik,
            role: item.role
        }))
        return res.json(uniks || [])
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch Uniks' })
    }
})

// GET /uniks/:id — Get details of specific Unik by its ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const unikId = req.params.id
        const { data, error } = await supabaseClient.from('uniks').select('*').eq('id', unikId).single()
        if (error) {
            return res.status(500).json({ error: error.message })
        }
        if (!data) {
            return res.status(404).json({ error: 'Unik not found' })
        }
        return res.json(data)
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch Unik details' })
    }
})

// POST /uniks — Create new Unik
router.post('/', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const { data: user, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }
        const userId = user.user.id
        const { name } = req.body
        const { data: insertData, error: insertError } = await supabaseClient
            .from('uniks')
            .insert({ name: name || 'New Workspace' })
            .select()
        if (insertError) {
            return res.status(500).json({ error: insertError.message })
        }
        const newUnik = insertData[0]
        const { error: relationError } = await supabaseClient.from('user_uniks').insert({
            user_id: userId,
            unik_id: newUnik.id,
            role: 'owner'
        })
        if (relationError) {
            return res.status(500).json({ error: relationError.message })
        }
        return res.status(201).json(newUnik)
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create Unik' })
    }
})

// PUT /uniks/:id — Update Unik (only name field)
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const { data: user, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }
        const userId = user.user.id
        const unikId = req.params.id
        const { name } = req.body
        // Check if user has a connection with this Unik (owner / editor)
        const { data: relationData, error: relationError } = await supabaseClient
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unikId)
            .eq('user_id', userId)
            .single()
        if (relationError || !relationData) {
            return res.status(403).json({ error: 'Not authorized to update this Unik' })
        }
        const allowedRoles = ['owner', 'editor']
        if (!allowedRoles.includes(relationData.role)) {
            return res.status(403).json({ error: 'Not authorized to update this Unik' })
        }
        const { data, error } = await supabaseClient.from('uniks').update({ name }).eq('id', unikId).select()
        if (error) {
            return res.status(500).json({ error: error.message })
        }
        if (!data.length) {
            return res.status(404).json({ error: 'Unik not found' })
        }
        return res.json(data[0])
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update Unik' })
    }
})

// DELETE /uniks/:id — Delete Unik (only owner)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const { data: user, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }
        const userId = user.user.id
        const unikId = req.params.id
        // Check if user_uniks has role 'owner'
        const { data: relationData, error: relationError } = await supabaseClient
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unikId)
            .eq('user_id', userId)
            .single()
        if (relationError || !relationData || relationData.role !== 'owner') {
            return res.status(403).json({ error: 'Not authorized to delete this Unik' })
        }
        const { error } = await supabaseClient.from('uniks').delete().eq('id', unikId)
        if (error) {
            return res.status(500).json({ error: error.message })
        }
        return res.status(204).send()
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete Unik' })
    }
})

// POST /uniks/members — Add member to Unik (only owner)
router.post('/members', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' })
        }
        const supabaseClient = getSupabaseClientWithAuth(token)
        const { data: user, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        }
        const { unik_id, user_id: memberUserId, role } = req.body
        const ownerId = user.user.id
        // Check if current user is the owner of the Unik
        const { data: relationData, error: relationError } = await supabaseClient
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unik_id)
            .eq('user_id', ownerId)
            .single()
        if (relationError || !relationData || relationData.role !== 'owner') {
            return res.status(403).json({ error: 'Not authorized to manage members of this Unik' })
        }
        const { data, error } = await supabaseClient.from('user_uniks').insert({ unik_id, user_id: memberUserId, role }).select()
        if (error) {
            return res.status(500).json({ error: error.message })
        }
        return res.status(201).json(data[0])
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add member to Unik' })
    }
})

// Mount nested routes for Chatflows with ensureAuth middleware
router.use('/:unikId/chatflows', upAuth.ensureAuth, chatflowsRouter)

// Mount nested routes for Chatflows Streaming with ensureAuth middleware
router.use('/:unikId/chatflows-streaming', upAuth.ensureAuth, chatflowsStreamingRouter)

// Mount nested routes for Chatflows Uploads with ensureAuth middleware
router.use('/:unikId/chatflows-uploads', upAuth.ensureAuth, chatflowsUploadsRouter)

// Mount nested routes for Flow Config with ensureAuth middleware
router.use('/:unikId/flow-config', upAuth.ensureAuth, flowConfigRouter)

// Mount nested routes for Tools with ensureAuth middleware
router.use('/:unikId/tools', upAuth.ensureAuth, toolsRouter)

// Mount nested routes for Variables with ensureAuth middleware
router.use('/:unikId/variables', upAuth.ensureAuth, variablesRouter)

// Mount nested routes for export/import with ensureAuth middleware
router.use('/:unikId/export-import', upAuth.ensureAuth, exportImportRouter)

// Mount nested routes for Credentials with ensureAuth middleware
router.use('/:unikId/credentials', upAuth.ensureAuth, credentialsRouter)

// Mount nested routes for Assistants with ensureAuth middleware
router.use('/:unikId/assistants', upAuth.ensureAuth, assistantsRouter)

// Mount nested routes for API Keys with ensureAuth middleware
router.use('/:unikId/apikey', upAuth.ensureAuth, apikeyRouter)

// Mount nested routes for Document Stores with ensureAuth middleware
router.use('/:unikId/document-stores', upAuth.ensureAuth, documentStoreRouter)

// Mount nested routes for Templates (Marketplaces) with ensureAuth middleware
router.use('/:unikId/templates', upAuth.ensureAuth, marketplacesRouter)

export default router
