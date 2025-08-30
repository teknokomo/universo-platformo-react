import { Router, Request, Response, RequestHandler } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'

export function createUniksRouter(
    ensureAuth: RequestHandler,
    supabase: SupabaseClient,
    chatflowsRouter: Router,
    chatflowsStreamingRouter: Router,
    chatflowsUploadsRouter: Router,
    flowConfigRouter: Router,
    toolsRouter: Router,
    variablesRouter: Router,
    exportImportRouter: Router,
    credentialsRouter: Router,
    assistantsRouter: Router,
    apikeyRouter: Router,
    documentStoreRouter: Router,
    marketplacesRouter: Router
) {
    const router = Router()

    // Apply ensureAuth middleware to all routes
    router.use(ensureAuth)

    // GET /uniks — Get list of Uniks for current user through user_uniks table
    router.get('/', async (req: Request, res: Response) => {
        try {
            // Get user ID from middleware (req.user should be set by ensureAuth)
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not found' })
            }

            const { data, error } = await supabase.from('user_uniks').select('role, unik:uniks(*)').eq('user_id', userId)

            if (error) {
                return res.status(500).json({ error: error.message })
            }

            const uniks = data.map((item: any) => ({
                ...item.unik,
                role: item.role
            }))

            return res.json(uniks || [])
        } catch (err) {
            console.error('Unexpected error fetching Uniks:', err)
            return res.status(500).json({ error: 'Failed to fetch Uniks' })
        }
    })

    // GET /uniks/:id — Get details of specific Unik by its ID
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const { data, error } = await supabase.from('uniks').select('*').eq('id', req.params.id).single()
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
            // Get user ID from middleware
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not found' })
            }

            const { name } = req.body
            const { data: insertData, error: insertError } = await supabase
                .from('uniks')
                .insert({ name: name || 'New Workspace' })
                .select()
            if (insertError) {
                return res.status(500).json({ error: insertError.message })
            }
            const newUnik = insertData[0]
            const { error: relationError } = await supabase.from('user_uniks').insert({
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
            // Get user ID from middleware
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not found' })
            }

            const unikId = req.params.id
            const { name } = req.body
            // Check if user has a connection with this Unik (owner / editor)
            const { data: relationData, error: relationError } = await supabase
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
            const { data, error } = await supabase.from('uniks').update({ name }).eq('id', unikId).select()
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
            // Get user ID from middleware
            const userId = (req as any).user?.sub
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized: User not found' })
            }

            const unikId = req.params.id
            // Check if user_uniks has role 'owner'
            const { data: relationData, error: relationError } = await supabase
                .from('user_uniks')
                .select('role')
                .eq('unik_id', unikId)
                .eq('user_id', userId)
                .single()
            if (relationError || !relationData || relationData.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to delete this Unik' })
            }
            const { error } = await supabase.from('uniks').delete().eq('id', unikId)
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
            // Get user ID from middleware
            const ownerId = (req as any).user?.sub
            if (!ownerId) {
                return res.status(401).json({ error: 'Unauthorized: User not found' })
            }

            const { unik_id, user_id: memberUserId, role } = req.body
            // Check if current user is the owner of the Unik
            const { data: relationData, error: relationError } = await supabase
                .from('user_uniks')
                .select('role')
                .eq('unik_id', unik_id)
                .eq('user_id', ownerId)
                .single()
            if (relationError || !relationData || relationData.role !== 'owner') {
                return res.status(403).json({ error: 'Not authorized to manage members of this Unik' })
            }
            const { data, error } = await supabase.from('user_uniks').insert({ unik_id, user_id: memberUserId, role }).select()
            if (error) {
                return res.status(500).json({ error: error.message })
            }
            return res.status(201).json(data[0])
        } catch (err) {
            return res.status(500).json({ error: 'Failed to add member to Unik' })
        }
    })

    // Mount nested routes for Chatflows with ensureAuth middleware
    router.use('/:unikId/chatflows', chatflowsRouter)

    // Mount nested routes for Chatflows Streaming with ensureAuth middleware
    router.use('/:unikId/chatflows-streaming', chatflowsStreamingRouter)

    // Mount nested routes for Chatflows Uploads with ensureAuth middleware
    router.use('/:unikId/chatflows-uploads', chatflowsUploadsRouter)

    // Mount nested routes for Flow Config with ensureAuth middleware
    router.use('/:unikId/flow-config', flowConfigRouter)

    // Mount nested routes for Tools with ensureAuth middleware
    router.use('/:unikId/tools', toolsRouter)

    // Mount nested routes for Variables with ensureAuth middleware
    router.use('/:unikId/variables', variablesRouter)

    // Mount nested routes for export/import with ensureAuth middleware
    router.use('/:unikId/export-import', exportImportRouter)

    // Mount nested routes for Credentials with ensureAuth middleware
    router.use('/:unikId/credentials', credentialsRouter)

    // Mount nested routes for Assistants with ensureAuth middleware
    router.use('/:unikId/assistants', assistantsRouter)

    // Mount nested routes for API Keys with ensureAuth middleware
    router.use('/:unikId/apikey', apikeyRouter)

    // Mount nested routes for Document Stores with ensureAuth middleware
    router.use('/:unikId/document-stores', documentStoreRouter)

    // Mount nested routes for Templates (Marketplaces) with ensureAuth middleware
    router.use('/:unikId/templates', marketplacesRouter)

    return router
}

export default createUniksRouter
