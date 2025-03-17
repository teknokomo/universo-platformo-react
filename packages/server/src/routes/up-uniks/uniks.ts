import { Router, Request, Response } from 'express'
import { getSupabaseClientWithAuth } from '../../utils/supabase'
import chatflowsRouter from '../chatflows' // Импорт вложенного роутера для Chatflows

const router = Router()

// GET /uniks — Получение списка Уников для текущего пользователя через таблицу user_uniks
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

// GET /uniks/:id — Получение деталей конкретного Unik по его ID
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

// POST /uniks — Создание нового Unik
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

// PUT /uniks/:id — Обновление Unik (только поле name)
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
        // Проверяем, что у пользователя есть связь с этим Unik (owner / editor)
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

// DELETE /uniks/:id — Удаление Unik (только владелец)
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
        // Проверяем, что в user_uniks есть роль 'owner'
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

// POST /uniks/members — Добавление участника в Unik (только владелец)
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
        // Проверяем, что текущий пользователь — владелец Unik
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

// Монтируем вложенные роуты для Chatflows
// Ключевое изменение: используем '/:unikId/chatflows' для явного указания, что Chatflows связаны с Unik.
router.use('/:unikId/chatflows', chatflowsRouter)

export default router
