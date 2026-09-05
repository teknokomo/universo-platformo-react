import { hashApplicationLayoutContent } from '../../utils/applicationLayoutHash'

describe('application layout content hash', () => {
    const layout = {
        scopeEntityId: null,
        templateKey: 'dashboard',
        name: { en: 'Main' },
        description: null,
        config: { showHeader: true },
        isActive: true,
        isDefault: true,
        sortOrder: 0
    }

    it('is stable when widget input order changes', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'right', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true },
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true },
                { zone: 'right', widgetKey: 'detailsTable', sortOrder: 2, config: {}, isActive: true }
            ]
        })

        expect(second).toBe(first)
    })

    it('changes when widget activation changes', () => {
        const active = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: true }]
        })
        const inactive = hashApplicationLayoutContent({
            layout,
            widgets: [{ zone: 'left', widgetKey: 'menuWidget', sortOrder: 1, config: {}, isActive: false }]
        })

        expect(inactive).not.toBe(active)
    })

    it('ignores physical row and lineage identifiers', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                    version: 4,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: { showSearch: true },
                    sourceWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                    sourceBaseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                    isActive: true
                }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-2222333344b1',
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333344b2',
                    version: 9,
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: { showSearch: true },
                    sourceWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344b3',
                    sourceBaseWidgetId: '018f8a78-7b8f-7c1d-a111-2222333344b4',
                    isActive: true
                }
            ]
        })

        expect(second).toBe(first)
    })

    it('ignores source baseline metadata when the effective widget config is unchanged', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: { datasource: { objectCodename: 'Products' } },
                    sourceConfig: { datasource: { objectCodename: 'Products' } },
                    isActive: true
                }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                {
                    zone: 'center',
                    widgetKey: 'detailsTable',
                    sortOrder: 1,
                    config: { datasource: { objectCodename: 'Products' } },
                    sourceConfig: { datasource: { objectCodename: 'Orders' } },
                    isActive: true
                }
            ]
        })

        expect(second).toBe(first)
    })

    it('uses the semantic instance key to order tied repeatable widgets', () => {
        const first = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'b' }, isActive: true },
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'a' }, isActive: true }
            ]
        })
        const second = hashApplicationLayoutContent({
            layout,
            widgets: [
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'a' }, isActive: true },
                { zone: 'center', widgetKey: 'detailsTable', sortOrder: 1, config: { instanceKey: 'b' }, isActive: true }
            ]
        })

        expect(second).toBe(first)
    })
})
