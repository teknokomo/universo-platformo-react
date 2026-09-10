import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import {
    materializeTrustedSnapshotLayoutsAndWidgets,
    resolveTrustedMaterializedLayout,
    type TrustedLayoutTarget
} from '../../routes/sync/trustedLayoutResolver'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'

const globalLayoutId = '019f2000-0000-7000-8000-000000000001'
const objectLayoutId = '019f2000-0000-7000-8000-000000000002'
const pageLayoutId = '019f2000-0000-7000-8000-000000000003'
const objectId = '019f2000-0000-7000-8000-000000000010'
const pageId = '019f2000-0000-7000-8000-000000000011'
const globalWidgetId = '019f2000-0000-7000-8000-000000000020'

const createSnapshot = (): PublishedApplicationSnapshot => ({
    entities: {
        [objectId]: { id: objectId, kind: 'object', codename: 'Products', fields: [] },
        [pageId]: { id: pageId, kind: 'page', codename: 'LandingPage', fields: [] }
    },
    layouts: [
        {
            id: globalLayoutId,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            description: null,
            config: {},
            compositionMode: 'independent',
            baseLayoutId: null,
            isActive: true,
            isDefault: true,
            sortOrder: 0
        }
    ],
    layoutZoneWidgets: [
        {
            id: globalWidgetId,
            layoutId: globalLayoutId,
            zone: 'top',
            widgetKey: 'header',
            sortOrder: 0,
            config: {},
            isActive: true
        }
    ],
    scopedLayouts: [
        {
            id: objectLayoutId,
            scopeEntityId: objectId,
            baseLayoutId: globalLayoutId,
            compositionMode: 'overlay',
            templateKey: 'dashboard',
            name: { en: 'Products dashboard' },
            description: null,
            config: { showHeader: false },
            isActive: true,
            isDefault: true,
            sortOrder: 0
        },
        {
            id: pageLayoutId,
            scopeEntityId: pageId,
            baseLayoutId: null,
            compositionMode: 'independent',
            templateKey: 'marketing-page',
            name: { en: 'Landing page' },
            description: null,
            config: { themeMode: 'light' },
            isActive: true,
            isDefault: true,
            sortOrder: 0
        }
    ],
    defaultLayoutId: globalLayoutId
})

describe('trusted layout materialization', () => {
    it.each([
        ['object', { targetKind: 'object', entityTypeId: objectId }],
        ['page', { targetKind: 'page', entityTypeId: pageId }]
    ] as const)('keeps %s target selection parity with materialization', (_label, target: TrustedLayoutTarget) => {
        const materialized = materializeTrustedSnapshotLayoutsAndWidgets(createSnapshot())
        const resolved = resolveTrustedMaterializedLayout(createSnapshot(), target)
        const expectedLayout = materialized.layouts.find((layout) => layout.id === resolved.layout.id)
        const stripGeneratedIds = (widgets: typeof resolved.widgets) =>
            widgets.map((widget) => {
                const comparableWidget = { ...widget }
                delete comparableWidget.id
                return comparableWidget
            })

        expect(expectedLayout).toEqual(resolved.layout)
        expect(stripGeneratedIds(resolved.widgets)).toEqual(
            stripGeneratedIds(materialized.widgets.filter((widget) => widget.layoutId === resolved.layout.id && widget.isActive))
        )
    })

    it('fails closed for an invalid target identity', () => {
        expect(() =>
            resolveTrustedMaterializedLayout(createSnapshot(), {
                targetKind: 'object',
                entityTypeId: '019f2000-0000-4000-8000-000000000010'
            })
        ).toThrow(new EffectiveLayoutError('LAYOUT_REQUEST_INVALID'))
    })

    it('accepts a custom physical entity kind on an object target', () => {
        const snapshot = createSnapshot()
        snapshot.entities[objectId] = {
            ...snapshot.entities[objectId],
            kind: 'custom-unknown-kind'
        } as never

        expect(
            resolveTrustedMaterializedLayout(snapshot, {
                targetKind: 'object',
                entityTypeId: objectId
            }).layout.id
        ).toBe(objectLayoutId)
    })

    it.each(['hub', 'set', 'enumeration', 'page', 'ledger'])('rejects %s as an object target', (kind) => {
        const snapshot = createSnapshot()
        snapshot.entities[objectId] = { ...snapshot.entities[objectId], kind } as never

        expect(() => resolveTrustedMaterializedLayout(snapshot, { targetKind: 'object', entityTypeId: objectId })).toThrow(
            new EffectiveLayoutError('LAYOUT_TARGET_NOT_FOUND')
        )
    })

    it('rejects a registrar-only ledger as an object target', () => {
        const snapshot = createSnapshot()
        snapshot.entities[objectId] = {
            ...snapshot.entities[objectId],
            kind: 'custom-ledger',
            config: { capabilities: { ledgerSchema: { enabled: true } }, ledger: { sourcePolicy: 'registrar' } }
        } as never

        expect(() => resolveTrustedMaterializedLayout(snapshot, { targetKind: 'object', entityTypeId: objectId })).toThrow(
            new EffectiveLayoutError('LAYOUT_TARGET_NOT_FOUND')
        )
    })

    it('fails closed when a scope has duplicate active defaults', () => {
        const snapshot = createSnapshot()
        snapshot.layouts = [
            ...(snapshot.layouts ?? []),
            {
                id: '019f2000-0000-7000-8000-000000000004',
                templateKey: 'dashboard',
                name: { en: 'Duplicate' },
                description: null,
                config: {},
                compositionMode: 'independent',
                baseLayoutId: null,
                isActive: true,
                isDefault: true,
                sortOrder: 1
            }
        ]
        delete snapshot.defaultLayoutId

        expect(() => resolveTrustedMaterializedLayout(snapshot, { targetKind: null })).toThrow(
            new EffectiveLayoutError('LAYOUT_DEFAULT_INVALID')
        )
    })
})
