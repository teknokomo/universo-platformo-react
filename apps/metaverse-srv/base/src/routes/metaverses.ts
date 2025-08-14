import { Router, Request, Response } from 'express'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// Factory type for creating per-request Supabase client (allow any schema)
export type SupabaseFactory = (req: Request) => SupabaseClient<any, any, any>

const CreateSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional()
})

export function createMetaverseRouter(createSupabaseForReq: SupabaseFactory) {
	const router = Router()

	// GET /metaverses — list metaverses for current user (by membership)
	router.get('/', async (req: Request, res: Response) => {
		try {
			const sb = createSupabaseForReq(req).schema('metaverse')
			const { data, error } = await sb
				.from('user_metaverses')
				.select('role,is_default, metaverse:metaverses(*)')
			if (error) return res.status(500).json({ error: error.message })
			const list = (data || []).map((r: any) => ({ ...r.metaverse, role: r.role, is_default: r.is_default }))
			return res.json(list)
		} catch (e) {
			return res.status(500).json({ error: 'Failed to list metaverses' })
		}
	})

	// POST /metaverses — create a new metaverse and owner membership
	router.post('/', async (req: Request, res: Response) => {
		const parsed = CreateSchema.safeParse(req.body)
		if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })

		const userId = (req as any).user?.sub || (req as any).user?.id
		if (!userId) return res.status(401).json({ error: 'Unauthorized' })

		try {
			const sb = createSupabaseForReq(req).schema('metaverse')
			const { data: mv, error: e1 } = await sb
				.from('metaverses')
				.insert({ ...parsed.data, created_by_user_id: userId })
				.select()
				.single()
			if (e1) return res.status(500).json({ error: e1.message })
			const { error: e2 } = await sb
				.from('user_metaverses')
				.insert({ user_id: userId, metaverse_id: mv.id, role: 'owner' })
			if (e2) return res.status(500).json({ error: e2.message })
			return res.status(201).json(mv)
		} catch (e) {
			return res.status(500).json({ error: 'Failed to create metaverse' })
		}
	})

	return router
}
