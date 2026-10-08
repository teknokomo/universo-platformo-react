import { hashApplicationLayoutContent, normalizeApplicationLayoutForHash } from '../../utils/applicationLayoutHash'

const uuid = (suffix: number) => `019f3100-0000-7000-8000-${String(suffix).padStart(12, '0')}`
const baseHash = 'a'.repeat(64)

const makeOverlayLayout = (scopeEntityId: string, baseLayoutId: string) => ({
    scopeEntityId,
    semanticScope: { entityKind: 'object', codename: 'Products' },
    templateKey: 'dashboard' as const,
    name: { en: 'Products' },
    description: null,
    config: { __layout: { composition: { mode: 'overlay', baseLayoutId } } },
    sourceComposition: { mode: 'overlay' as const, baseLayoutId },
    baseLayoutContentHash: baseHash,
    isActive: true,
    isDefault: false,
    sortOrder: 2
})

const makeNestedWidgets = (layoutId: string, containerId: string, childId: string) => [
    {
        id: containerId,
        layoutId,
        zone: 'center',
        widgetKey: 'columnsContainer',
        instanceKey: 'product-grid',
        parentWidgetId: null,
        slotKey: null,
        sortOrder: 1,
        config: { columns: [{ slotKey: 'column:main', width: 12 }] },
        isActive: true
    },
    {
        id: childId,
        layoutId,
        zone: 'center',
        widgetKey: 'detailsTable',
        instanceKey: 'product-table',
        parentWidgetId: containerId,
        slotKey: 'column:main',
        sortOrder: 1,
        config: {},
        isActive: true
    }
]

describe('application layout content hash', () => {
    it('keeps nested source, UUID-remapped restore, and materialized overlay hashes equal (H1=H2=H3)', () => {
        const h1Input = {
            layout: makeOverlayLayout(uuid(1), uuid(2)),
            widgets: makeNestedWidgets(uuid(3), uuid(4), uuid(5))
        }
        const h2Input = {
            layout: makeOverlayLayout(uuid(6), uuid(7)),
            widgets: makeNestedWidgets(uuid(8), uuid(9), uuid(10)).map((widget) => ({
                ...widget,
                sourceWidgetId: uuid(widget.instanceKey === 'product-grid' ? 11 : 12),
                sourceBaseWidgetId: uuid(widget.instanceKey === 'product-grid' ? 13 : 14)
            }))
        }
        const h3Input = {
            layout: makeOverlayLayout(uuid(15), uuid(16)),
            widgets: makeNestedWidgets(uuid(17), uuid(18), uuid(19))
                .reverse()
                .map((widget) => ({
                    ...widget,
                    sourceWidgetId: uuid(widget.instanceKey === 'product-grid' ? 25 : 26),
                    sourceBaseWidgetId: uuid(widget.instanceKey === 'product-grid' ? 27 : 28)
                }))
        }

        const h1 = hashApplicationLayoutContent(h1Input)
        const h2 = hashApplicationLayoutContent(h2Input)
        const h3 = hashApplicationLayoutContent(h3Input)
        const portable = JSON.stringify(normalizeApplicationLayoutForHash(h1Input))

        expect(h1).toBe(h2)
        expect(h2).toBe(h3)
        expect(portable).toContain('"parent":{"instanceKey":"product-grid","slotKey":"column:main"}')
        expect(portable).toContain('"sourceAuthority":"source-managed"')
        for (const physicalId of [uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)]) {
            expect(portable).not.toContain(physicalId)
        }
        const inheritedPortable = JSON.stringify(normalizeApplicationLayoutForHash(h2Input))
        expect(inheritedPortable).toContain('"sourceAuthority":"source-managed"')
        for (const physicalId of [
            uuid(6),
            uuid(7),
            uuid(8),
            uuid(9),
            uuid(10),
            uuid(13),
            uuid(14),
            uuid(25),
            uuid(26),
            uuid(27),
            uuid(28)
        ]) {
            expect(inheritedPortable).not.toContain(physicalId)
        }
    })

    it('requires placement identity and rejects renderer config identity', () => {
        const layout = {
            templateKey: 'dashboard' as const,
            name: { en: 'Main' },
            config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } },
            sourceComposition: { mode: 'independent' as const, baseLayoutId: null }
        }

        expect(() =>
            hashApplicationLayoutContent({
                layout,
                widgets: [
                    {
                        zone: 'center',
                        widgetKey: 'detailsTable',
                        sortOrder: 1,
                        config: {},
                        isActive: true,
                        parentWidgetId: null,
                        slotKey: null
                    } as never
                ]
            })
        ).toThrow()
        expect(() =>
            hashApplicationLayoutContent({
                layout,
                widgets: [
                    {
                        zone: 'center',
                        widgetKey: 'detailsTable',
                        instanceKey: 'table',
                        parentWidgetId: null,
                        slotKey: null,
                        sortOrder: 1,
                        config: { instanceKey: 'forged' },
                        isActive: true
                    }
                ]
            })
        ).toThrow('APPLICATION_LAYOUT_WIDGET_CONFIG_IDENTITY_FORBIDDEN')
    })

    it('hashes scoped layouts by trusted semantic Entity scope and portable base content', () => {
        const first = hashApplicationLayoutContent({
            layout: makeOverlayLayout(uuid(21), uuid(22)),
            widgets: []
        })
        const remapped = hashApplicationLayoutContent({
            layout: makeOverlayLayout(uuid(23), uuid(24)),
            widgets: []
        })
        const changedScope = hashApplicationLayoutContent({
            layout: {
                ...makeOverlayLayout(uuid(25), uuid(26)),
                semanticScope: { entityKind: 'object', codename: 'Orders' }
            },
            widgets: []
        })
        const changedBase = hashApplicationLayoutContent({
            layout: { ...makeOverlayLayout(uuid(27), uuid(28)), baseLayoutContentHash: 'b'.repeat(64) },
            widgets: []
        })

        expect(remapped).toBe(first)
        expect(changedScope).not.toBe(first)
        expect(changedBase).not.toBe(first)
    })
})
