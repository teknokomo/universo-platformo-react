import { Request, Response } from 'express'
import { supabase } from '../../utils/supabase'

// Получение списка Уников для текущего пользователя через таблицу user_uniks
const getUniks = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    // Получаем записи из user_uniks, подгружаем данные Unik по связи (unik:uniks(*))
    const { data, error } = await supabase.from('user_uniks').select('role, unik:uniks(*)').eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })

    // Преобразуем результат так, чтобы каждая запись включала поля Unik + свою роль
    const uniks = data.map((item: any) => ({
        ...item.unik,
        role: item.role
    }))

    res.json(uniks || [])
}

// Создание нового Уника + связь с пользователем (роль 'owner')
const createUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { name, name_translations, description_translations, flow_data } = req.body

    // Создаём новую запись в таблице uniks
    const { data: insertData, error: insertError } = await supabase
        .from('uniks')
        .insert({
            name: name || 'New Workspace',
            name_translations: name_translations || {},
            description_translations: description_translations || {},
            flow_data: flow_data || { nodes: [], edges: [] },
            api_key: `unik_${Math.random().toString(36).substring(2, 15)}`
        })
        .select()

    if (insertError) return res.status(500).json({ error: insertError.message })
    const newUnik = insertData[0]

    // Создаём связь в user_uniks с ролью 'owner'
    const { error: relationError } = await supabase.from('user_uniks').insert({
        user_id: userId,
        unik_id: newUnik.id,
        role: 'owner'
    })

    if (relationError) return res.status(500).json({ error: relationError.message })

    res.status(201).json(newUnik)
}

// Обновление Уника (доступно, если роль 'owner' или 'editor')
const updateUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { id } = req.params
    const { name_translations, description_translations, flow_data } = req.body

    // Проверяем связь user_uniks
    const { data: relation, error: relationError } = await supabase
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

    // Обновляем запись
    const { data: updateData, error: updateError } = await supabase
        .from('uniks')
        .update({
            name_translations: { ...name_translations },
            description_translations: { ...description_translations },
            flow_data: { ...flow_data },
            updated_at: new Date()
        })
        .eq('id', id)
        .select()

    if (updateError) return res.status(500).json({ error: updateError.message })
    if (!updateData.length) return res.status(404).json({ error: 'Unik not found' })

    res.json(updateData[0])
}

// Удаление Уника (доступно, если роль 'owner')
const deleteUnik = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const { data: user, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })
    const userId = user.user.id

    const { id } = req.params

    // Проверяем, что пользователь – 'owner'
    const { data: relation, error: relationError } = await supabase
        .from('user_uniks')
        .select('role')
        .eq('unik_id', id)
        .eq('user_id', userId)
        .single()

    if (relationError || !relation || relation.role !== 'owner') {
        return res.status(403).json({ error: 'Not authorized to delete this Unik' })
    }

    // Удаляем запись из uniks
    const { error } = await supabase.from('uniks').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })

    res.status(204).send()
}

// Единый экспорт всех функций
export { getUniks, createUnik, updateUnik, deleteUnik }
