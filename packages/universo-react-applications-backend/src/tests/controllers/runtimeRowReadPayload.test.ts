import { objectCollectionRuntimeViewConfigSchema } from '@universo-react/types'
import { normalizeObjectCollectionRuntimeViewConfig } from '@universo-react/utils'
import { buildRuntimeReadResponsePayload, buildRuntimeReadSections } from '../../controllers/runtimeRowReadHandlers/payload'
import type { RuntimeReadObjectCollection, RuntimeReadRuntimeConfig } from '../../controllers/runtimeRowReadHandlers/types'
import { normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'

describe('runtime row read payload', () => {
    it('keeps reorder authority out of object collection runtime view metadata', () => {
        const activeObjectCollection = {
            id: 'object-1',
            kind: 'object',
            codename: 'Structures',
            table_name: 'structures',
            config: null
        } as RuntimeReadObjectCollection
        const activeObjectCollectionRuntimeConfig = {
            ...normalizeObjectCollectionRuntimeViewConfig({ showCreateButton: false, createSurface: 'page' }),
            enableRowReordering: true,
            reorderPersistenceField: 'SortOrder'
        } satisfies RuntimeReadRuntimeConfig
        const objectCollectionsForRuntime = buildRuntimeReadSections({
            runtimeObjects: [activeObjectCollection],
            activeObjectCollection,
            activeObjectCollectionRuntimeConfig,
            requestedLocale: 'en'
        }).objectCollectionsForRuntime
        const runtimeContext = {
            applicationSettings: {},
            workspacesEnabled: false,
            currentWorkspaceId: null,
            permissions: {},
            workflowCapabilities: {}
        } as RuntimeSchemaContext

        const payload = buildRuntimeReadResponsePayload({
            runtimeContext,
            activeObjectCollection,
            activeObjectCollectionKind: 'object',
            isActivePage: false,
            activeRecordBehavior: normalizeRuntimeRecordBehavior(undefined),
            activeWorkflowActions: [],
            activeObjectCollectionRuntimeConfig,
            requestedLocale: 'en',
            objectCollectionsForRuntime,
            columns: [],
            rows: [],
            total: 0,
            limit: 20,
            offset: 0,
            workspaceLimit: undefined
        })
        const expectedRuntimeConfig = {
            showCreateButton: false,
            createSurface: 'page',
            editSurface: 'dialog',
            copySurface: 'dialog'
        }

        const runtimeMetadata = [payload.section, payload.objectCollection, payload.sections[0], payload.objectCollections[0]] as Array<{
            runtimeConfig: unknown
        }>

        for (const metadata of runtimeMetadata) {
            expect(objectCollectionRuntimeViewConfigSchema.parse(metadata.runtimeConfig)).toEqual(expectedRuntimeConfig)
            expect(metadata.runtimeConfig).not.toHaveProperty('enableRowReordering')
            expect(metadata.runtimeConfig).not.toHaveProperty('reorderPersistenceField')
        }
    })
})
