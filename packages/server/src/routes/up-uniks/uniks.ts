import { Router, Request, Response } from 'express'
import { supabase } from '../../utils/supabase'

const router = Router()

// Получение списка Уников для текущего пользователя через таблицу user_uniks
router.get('/', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id

        // Запрашиваем записи из таблицы user_uniks с выборкой связанных записей из uniks
        const { data, error } = await supabase.from('user_uniks').select('role, unik:uniks(*)').eq('user_id', userId)

        if (error) return res.status(500).json({ error: error.message })
        // Извлекаем объект uniks и добавляем к нему роль пользователя
        const uniks = data.map((item: any) => ({
            ...item.unik,
            role: item.role
        }))
        res.json(uniks || [])
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch Uniks' })
    }
})

// Создание нового Уника и создание связи в user_uniks с ролью 'owner'
router.post('/', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })

        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const { name, name_translations, description_translations, flow_data } = req.body

        // Вставляем новый Уник в таблицу uniks (без указания владельца)
        const { data, error } = await supabase
            .from('uniks')
            .insert({
                name: name || 'New Workspace',
                name_translations: name_translations || {},
                description_translations: description_translations || {},
                flow_data: flow_data || { nodes: [], edges: [] },
                api_key: `unik_${Math.random().toString(36).substring(2, 15)}`
            })
            .select()
        if (error) return res.status(500).json({ error: error.message })
        const newUnik = data[0]

        // Создаем связь в таблице user_uniks с ролью 'owner'
        const { error: relationError } = await supabase.from('user_uniks').insert({
            user_id: userId,
            unik_id: newUnik.id,
            role: 'owner'
        })
        if (relationError) return res.status(500).json({ error: relationError.message })
        res.status(201).json(newUnik)
    } catch (err) {
        res.status(500).json({ error: 'Failed to create Unik' })
    }
})

// Обновление существующего Уника (только если у пользователя есть права через user_uniks)
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const unikId = req.params.id
        const { name_translations, description_translations, flow_data } = req.body

        // Проверяем, что у пользователя есть связь с этим Уником с ролью 'owner' или 'editor'
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

        const { data, error } = await supabase
            .from('uniks')
            .update({
                name_translations: { ...name_translations },
                description_translations: { ...description_translations },
                flow_data: { ...flow_data },
                updated_at: new Date()
            })
            .eq('id', unikId)
            .select()
        if (error) return res.status(500).json({ error: error.message })
        if (!data.length) return res.status(404).json({ error: 'Unik not found' })
        res.json(data[0])
    } catch (err) {
        res.status(500).json({ error: 'Failed to update Unik' })
    }
})

// Удаление Уника (только если пользователь является владельцем)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const unikId = req.params.id

        // Проверяем, что связь в user_uniks существует и имеет роль 'owner'
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
        if (error) return res.status(500).json({ error: error.message })
        res.status(204).send()
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete Unik' })
    }
})

// Добавление участника в Уник
router.post('/members', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })

        const { unik_id, user_id: memberUserId, role } = req.body
        const ownerId = user.user.id

        // Проверяем, что текущий пользователь является владельцем данного Уника
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
        if (error) return res.status(500).json({ error: error.message })
        res.status(201).json(data[0])
    } catch (err) {
        res.status(500).json({ error: 'Failed to add member to Unik' })
    }
})

// Управление Flow внутри Уника (Chatflows, Agentflows)
router.get('/flows/:unikId', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const unikId = req.params.unikId

        // Проверяем, что у пользователя есть связь с данным Уником
        const { data: relationData, error: relationError } = await supabase
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unikId)
            .eq('user_id', userId)
            .single()
        if (relationError || !relationData) {
            return res.status(403).json({ error: 'Not authorized to access flows in this Unik' })
        }

        // Получаем flow_data из таблицы uniks
        const { data, error } = await supabase.from('uniks').select('flow_data').eq('id', unikId).single()
        if (error) return res.status(500).json({ error: error.message })
        res.json(data.flow_data || { nodes: [], edges: [] })
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch flows' })
    }
})

router.post('/flows/:unikId', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const unikId = req.params.unikId
        const { flow_data } = req.body

        // Проверяем, что пользователь имеет права обновлять Flow (owner или editor)
        const { data: relationData, error: relationError } = await supabase
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unikId)
            .eq('user_id', userId)
            .single()
        if (relationError || !relationData || !['owner', 'editor'].includes(relationData.role)) {
            return res.status(403).json({ error: 'Not authorized to update flows in this Unik' })
        }

        // (Дополнительная логика проверки активных редакторов может быть добавлена здесь)
        const { data, error } = await supabase.from('uniks').update({ flow_data, updated_at: new Date() }).eq('id', unikId).select()
        if (error) return res.status(500).json({ error: error.message })
        if (!data.length) return res.status(404).json({ error: 'Unik not found' })
        res.json(data[0].flow_data)
    } catch (err) {
        res.status(500).json({ error: 'Failed to update flows' })
    }
})

// Реал-тайм подписка на изменения Flow
router.get('/flows/:unikId/realtime', async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' })
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        if (userError || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' })
        const userId = user.user.id
        const unikId = req.params.unikId

        // Проверяем, что у пользователя есть связь с данным Уником
        const { data: relationData, error: relationError } = await supabase
            .from('user_uniks')
            .select('role')
            .eq('unik_id', unikId)
            .eq('user_id', userId)
            .single()
        if (relationError || !relationData) {
            return res.status(403).json({ error: 'Not authorized to access flows in this Unik' })
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const channel = supabase
            .channel(`unik_${unikId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'uniks', filter: `id=eq.${unikId}` }, (payload) => {
                res.write(`data: ${JSON.stringify(payload.new.flow_data)}\n\n`)
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniks', filter: `id=eq.${unikId}` }, (payload) => {
                res.write(`data: ${JSON.stringify(payload.new.flow_data)}\n\n`)
            })
            .subscribe()

        req.on('close', () => {
            channel.unsubscribe()
        })
    } catch (err) {
        res.status(500).json({ error: 'Failed to establish realtime connection' })
    }
})

export default router
