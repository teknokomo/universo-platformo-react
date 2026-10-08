import { describe, expect, it } from 'vitest'
import { DASHBOARD_WIDGET_CONFIG_SCHEMAS } from '../common/dashboardWidgetConfigSchemas'
import { getLayoutWidgetDefinition } from '../common/layoutWidgetDefinitions'
import { validateWidgetBindings } from '../common/widgetBindings'

const config = { variant: 'report', reportCodename: 'LearningContentSummary' }

describe('saved report widget source', () => {
    it.each([{}, { variant: 'records' }])('keeps required rows for records config %j', (rendererConfig) => {
        const definition = getLayoutWidgetDefinition('detailsTable', rendererConfig)!
        expect(definition.bindingSlots?.map(({ key }) => key)).toEqual(['rows'])
        expect(() => validateWidgetBindings(definition, { version: 1, slots: [] })).toThrow()
    })

    it('uses an explicit specialized report variant without Entity bindings', () => {
        const definition = getLayoutWidgetDefinition('detailsTable', config)!
        expect(definition.bindingSlots).toEqual([])
        expect(validateWidgetBindings(definition, { version: 1, slots: [] }).slots).toEqual([])
        expect(definition.sourcePolicy.authority).toBe('metahub-source')
        expect(definition.sourcePolicy).toMatchObject({ sourceMode: 'specialized', inheritBindings: false })
        expect(definition.sourceClass).toBe('specialized-runtime')
        expect(definition.presentationFields).toEqual([])
        expect(definition.copyPolicy).toEqual({ placement: 'copy', binding: 'none' })
        expect(definition.authoring.metahub).toMatchObject({ duplicate: 'none', contentEditing: 'none', canRebind: false })
        expect(definition.capabilities).toEqual(['dashboard.runtime'])
        expect(definition.configFields).toEqual([
            { path: 'rowHeight', owner: 'presentation' },
            { path: 'reportCodename', owner: 'specialized-runtime' },
            { path: 'variant', owner: 'specialized-runtime' }
        ])
        expect(definition.configFields).toContainEqual({ path: 'reportCodename', owner: 'specialized-runtime' })
    })

    it('requires a strict semantic reference and rejects embedded definitions and legacy config', () => {
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTable.parse(config)).toEqual(config)
        for (const invalid of [
            { variant: 'report' },
            { reportCodename: 'LearningContentSummary' },
            { variant: 'records', reportCodename: 'LearningContentSummary' },
            { ...config, reportCodename: '' },
            { ...config, reportCodename: 'not a codename' },
            { ...config, reportDefinition: {} },
            { ...config, rowActions: [] },
            { ...config, targetFilters: [] },
            { ...config, createTargets: [] },
            { ...config, restoreTarget: {} },
            { ...config, workflowActions: [] },
            { ...config, sequencePolicy: {} },
            { ...config, datasource: { kind: 'report' } },
            { ...config, widgets: [] }
        ])
            expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTable.safeParse(invalid).success).toBe(false)
    })
})
