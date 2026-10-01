import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { ensureMetahubAccess } from '../../shared/guards'
import { uuidV7Schema } from '@universo-react/utils'
import {
    duplicateMarketingWidgetRecordAndPlace,
    marketingWidgetRecordDuplicateRequestSchema
} from '../services/marketingWidgetRecordDuplicate'

export function createMarketingWidgetRecordDuplicateController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const duplicateZoneWidget = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const layoutId = uuidV7Schema.safeParse(req.params.layoutId)
            if (!layoutId.success) return res.status(400).json({ error: 'Invalid layout ID' })

            const parsed = marketingWidgetRecordDuplicateRequestSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')
            const item = await duplicateMarketingWidgetRecordAndPlace({
                executor: exec,
                metahubId,
                layoutId: layoutId.data,
                userId,
                request: parsed.data
            })
            return res.status(201).json(item)
        },
        { permission: 'manageMetahub' }
    )

    return { duplicateZoneWidget }
}
