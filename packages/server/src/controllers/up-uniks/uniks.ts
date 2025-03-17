import { Request, Response } from 'express'
import { getSupabaseClientWithAuth } from '../../utils/supabase'

// Получение списка Uniks для текущего пользователя через таблицу user_uniks
export const getUniks = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabaseClient = getSupabaseClientWithAuth(token)

    const { data: user, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { data, error } = await supabaseClient.from('user_uniks').select('role, unik:uniks(*)').eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })

    const uniks = data.map((item: any) => ({
        ...item.unik,
        role: item.role
    }))

    res.json(uniks || [])
}

// Создание нового Unik + создание связи с пользователем (роль 'owner')
export const createUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabaseClient = getSupabaseClientWithAuth(token)

    const { data: user, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { name } = req.body

    const { data: insertData, error: insertError } = await supabaseClient
        .from('uniks')
        .insert({ name: name || 'New Workspace' })
        .select()

    if (insertError) return res.status(500).json({ error: insertError.message })
    const newUnik = insertData[0]

    const { error: relationError } = await supabaseClient.from('user_uniks').insert({
        user_id: userId,
        unik_id: newUnik.id,
        role: 'owner'
    })

    if (relationError) return res.status(500).json({ error: relationError.message })

    res.status(201).json(newUnik)
}

// Обновление Unik (доступно, если роль 'owner' или 'editor')
export const updateUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabaseClient = getSupabaseClientWithAuth(token)

    const { data: user, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { id } = req.params
    const { name } = req.body

    const { data: relation, error: relationError } = await supabaseClient
        .from('user_uniks')
        .select('role')
        .eq('unik_id', id)
        .eq('user_id', userId)
        .single()

    if (relationError || !relation) {
        return res.status(403).json({ error: 'Not authorized to update this Unik' })
    }

    const allowedRoles = ['owner', 'editor']
    if (!allowedRoles.includes(relation.role)) {
        return res.status(403).json({ error: 'Not authorized to update this Unik' })
    }

    const { data: updateData, error: updateError } = await supabaseClient.from('uniks').update({ name }).eq('id', id).select()

    if (updateError) return res.status(500).json({ error: updateError.message })
    if (!updateData || updateData.length === 0) return res.status(404).json({ error: 'Unik not found' })

    res.json(updateData[0])
}

// Удаление Unik (доступно, если роль 'owner')
export const deleteUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabaseClient = getSupabaseClientWithAuth(token)

    const { data: user, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { id } = req.params

    const { data: relation, error: relationError } = await supabaseClient
        .from('user_uniks')
        .select('role')
        .eq('unik_id', id)
        .eq('user_id', userId)
        .single()

    if (relationError || !relation || relation.role !== 'owner') {
        return res.status(403).json({ error: 'Not authorized to delete this Unik' })
    }

    const { error } = await supabaseClient.from('uniks').delete().eq('id', id)

    if (error) return res.status(500).json({ error: error.message })

    res.status(204).send()
}
