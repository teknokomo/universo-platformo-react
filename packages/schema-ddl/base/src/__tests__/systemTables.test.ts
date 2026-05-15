import { normalizeSystemTableCapabilities, resolveSystemTableNames } from '../systemTables'

describe('systemTables helpers', () => {
    it('normalizes capability options with full application-like defaults', () => {
        expect(normalizeSystemTableCapabilities()).toEqual({
            includeComponents: true,
            includeValues: true,
            includeLayouts: true,
            includeWidgets: true
        })
    })

    it('rejects widgets without layouts', () => {
        expect(() =>
            normalizeSystemTableCapabilities({
                includeLayouts: false,
                includeWidgets: true
            })
        ).toThrow('System table capabilities cannot enable _app_widgets without _app_layouts')
    })

    it('resolves the deterministic system-table preview for minimal fixed schemas', () => {
        expect(
            resolveSystemTableNames({
                includeComponents: false,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            })
        ).toEqual(['_app_migrations', '_app_settings', '_app_objects', '_app_record_counters', '_app_scripts'])
    })

    it('resolves the deterministic system-table preview for capability-rich fixed schemas', () => {
        expect(
            resolveSystemTableNames({
                includeComponents: true,
                includeValues: true,
                includeLayouts: true,
                includeWidgets: true
            })
        ).toEqual([
            '_app_migrations',
            '_app_settings',
            '_app_objects',
            '_app_record_counters',
            '_app_components',
            '_app_values',
            '_app_scripts',
            '_app_layouts',
            '_app_widgets'
        ])
    })
})
