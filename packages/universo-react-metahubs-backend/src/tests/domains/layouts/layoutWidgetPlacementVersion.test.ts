import type { DbExecutor } from '@universo-react/utils'
import { MetahubLayoutWidgetPlacementService } from '../../../domains/layouts/services/layoutWidgetPlacementService'
import { duplicateLayoutZoneWidgetSchema } from '../../../domains/layouts/services/layoutServiceContracts'
import type { MetahubSchemaService } from '../../../domains/metahubs/services/MetahubSchemaService'

const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a2'

describe('duplicateLayoutZoneWidget concurrency contract', () => {
    it('requires both layout and widget revisions', () => {
        expect(duplicateLayoutZoneWidgetSchema.safeParse({ widgetId, expectedVersion: 3 }).success).toBe(false)
        expect(duplicateLayoutZoneWidgetSchema.safeParse({ widgetId, expectedVersion: 3, expectedLayoutVersion: 7 }).success).toBe(true)
    })

    it('rejects a stale layout revision before any default seeding or subtree copy', async () => {
        const executor = {
            transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({} as DbExecutor))
        } as unknown as DbExecutor
        const schemaService = {
            ensureSchema: jest.fn().mockResolvedValue('mhb_0190a9b53cde7abc8def0123456789a3')
        } as unknown as MetahubSchemaService
        const service = new MetahubLayoutWidgetPlacementService(executor, schemaService)
        const internals = service as unknown as Record<string, jest.Mock>
        internals.acquireLayoutGraphLock = jest.fn().mockResolvedValue(undefined)
        internals.lockLayoutScopeRow = jest.fn().mockResolvedValue({ id: layoutId, template_key: 'dashboard', version: 8 })
        internals.ensureDefaultZoneWidgets = jest.fn().mockResolvedValue(undefined)

        await expect(
            service.duplicateLayoutZoneWidget('0190a9b5-3cde-7abc-8def-0123456789a3', layoutId, {
                widgetId,
                expectedVersion: 4,
                expectedLayoutVersion: 7
            })
        ).rejects.toThrow('Layout was modified by another request')

        expect(internals.ensureDefaultZoneWidgets).not.toHaveBeenCalled()
        expect(executor.transaction).toHaveBeenCalledTimes(1)
    })
})
