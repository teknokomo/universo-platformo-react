import { getLayoutWidgetDefinition } from '@universo-react/types'
import {
    assertLayoutWidgetBindingAuthority,
    assertLayoutWidgetCanAuthorBindings,
    layoutWidgetOwnsBindings,
    layoutWidgetOwnsComposition,
    requireLayoutWidgetOwnership,
    type LayoutWidgetOwnershipDefinition
} from '../../domains/layouts/widgetOwnership'

describe('layout widget ownership policy', () => {
    it('keeps source-owned bindings with the base placement across inherited lineage', () => {
        const definition = requireLayoutWidgetOwnership('marketing-page', 'marketing.hero')
        const independentLineage = { scopeEntityId: null, baseLayoutId: null }
        const independentScopedLineage = { scopeEntityId: 'scope-1', baseLayoutId: null }
        const scopedOverlayLineage = { scopeEntityId: 'scope-1', baseLayoutId: 'base-1' }
        const inheritedLineage = { scopeEntityId: null, baseLayoutId: 'base-1' }

        expect(layoutWidgetOwnsBindings(definition, independentLineage)).toBe(true)
        expect(layoutWidgetOwnsBindings(definition, independentScopedLineage)).toBe(true)
        expect(layoutWidgetOwnsBindings(definition, scopedOverlayLineage)).toBe(false)
        expect(layoutWidgetOwnsBindings(definition, inheritedLineage)).toBe(false)
        expect(() => assertLayoutWidgetCanAuthorBindings(definition, independentScopedLineage)).not.toThrow()
        expect(() => assertLayoutWidgetCanAuthorBindings(definition, scopedOverlayLineage)).toThrow(
            'This placement inherits or specializes its Entity bindings'
        )
        expect(() => assertLayoutWidgetBindingAuthority({ definition, lineage: inheritedLineage, hasBindings: true })).toThrow(
            'This layout inherits Entity bindings from its source placement'
        )

        const dashboardDetails = requireLayoutWidgetOwnership('dashboard', 'detailsTable')
        expect(() =>
            assertLayoutWidgetBindingAuthority({ definition: dashboardDetails, lineage: independentScopedLineage, hasBindings: true })
        ).not.toThrow()
        expect(() =>
            assertLayoutWidgetBindingAuthority({ definition: dashboardDetails, lineage: scopedOverlayLineage, hasBindings: true })
        ).toThrow('This layout inherits Entity bindings from its source placement')

        const container = requireLayoutWidgetOwnership('dashboard', 'columnsContainer')
        expect(layoutWidgetOwnsComposition(container, independentScopedLineage)).toBe(true)
        expect(layoutWidgetOwnsComposition(container, scopedOverlayLineage)).toBe(false)
    })

    it('allows local optional bindings while denying specialized and empty source modes', () => {
        const registered = getLayoutWidgetDefinition('menuWidget')
        if (!registered) throw new Error('Expected menuWidget registry entry')
        const localDefinition = {
            ...registered,
            sourcePolicy: {
                authority: 'local',
                sourceMode: 'optional',
                inheritBindings: false,
                inheritComposition: false
            }
        } as LayoutWidgetOwnershipDefinition
        const localLineage = { scopeEntityId: null, baseLayoutId: null }
        const host = requireLayoutWidgetOwnership('dashboard', 'userProfile')

        expect(layoutWidgetOwnsBindings(localDefinition, localLineage)).toBe(true)
        expect(layoutWidgetOwnsBindings(host, localLineage)).toBe(false)
    })
})
