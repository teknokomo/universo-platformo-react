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

        type RuntimeReadPayloadFixture = {
            section: Record<string, unknown>
            objectCollection: Record<string, unknown>
            sections: Record<string, unknown>[]
            objectCollections: Record<string, unknown>[]
        }
        const payloadFixture = payload as unknown as RuntimeReadPayloadFixture
        const runtimeMetadata = [
            payloadFixture.section,
            payloadFixture.objectCollection,
            payloadFixture.sections[0],
            payloadFixture.objectCollections[0]
        ]

        for (const metadata of runtimeMetadata) {
            expect(objectCollectionRuntimeViewConfigSchema.parse(metadata.runtimeConfig)).toEqual(expectedRuntimeConfig)
            expect(metadata.runtimeConfig).not.toHaveProperty('enableRowReordering')
            expect(metadata.runtimeConfig).not.toHaveProperty('reorderPersistenceField')
        }
    })

    it('projects Entity mutation policy into effective runtime permissions', () => {
        const permissions = {
            manageMembers: true,
            manageApplication: true,
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: true
        }
        const activeObjectCollection = {
            id: 'object-1',
            kind: 'object',
            codename: 'MarketingPageSiteSettings',
            table_name: 'marketing_page_site_settings',
            config: {
                recordPolicy: {
                    version: 1,
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    runtimeMutation: 'deny'
                }
            }
        } as RuntimeReadObjectCollection
        const runtimeContext = {
            applicationSettings: {},
            workspacesEnabled: false,
            currentWorkspaceId: null,
            permissions,
            workflowCapabilities: {}
        } as RuntimeSchemaContext
        const activeObjectCollectionRuntimeConfig = normalizeObjectCollectionRuntimeViewConfig(undefined) as RuntimeReadRuntimeConfig
        const objectCollectionsForRuntime = buildRuntimeReadSections({
            runtimeObjects: [activeObjectCollection],
            activeObjectCollection,
            activeObjectCollectionRuntimeConfig,
            requestedLocale: 'en'
        }).objectCollectionsForRuntime

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

        expect(payload.permissions).toEqual({
            ...permissions,
            createContent: false,
            editContent: false,
            deleteContent: false
        })
    })
})
