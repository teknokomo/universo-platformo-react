import { encodeWidgetConfigEnvelope, getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { resolveLayoutCopyBindings } from '../../domains/layouts/services/layoutCopyBindings'

const navigationDefinition = getLayoutWidgetDefinition('marketing.navigation')
if (!navigationDefinition) throw new Error('The Navigation widget definition must be registered')
const navigationSlot = navigationDefinition.bindingSlots?.find(({ key }) => key === 'items')
if (!navigationSlot) throw new Error('The Navigation items binding must be registered')

const navigationBindings = validateWidgetBindings(navigationDefinition, {
    version: 1,
    slots: [
        {
            slot: 'items',
            targets: [
                {
                    entityKind: 'object',
                    entityCodename: 'MarketingPageNavigation',
                    selector: { kind: 'record-set' },
                    projection: navigationSlot.requirements.components.map(({ field, componentCodename }) => ({
                        field,
                        componentCodename
                    }))
                }
            ]
        }
    ]
})
const navigationConfig = encodeWidgetConfigEnvelope(
    { rendererConfig: { maxItems: 12 }, neutral: { bindings: navigationBindings } },
    { templateKey: 'marketing-page', widgetKey: 'marketing.navigation', zone: 'marketing-header' }
)

describe('resolveLayoutCopyBindings', () => {
    it('requires an explicit generic binding policy for direct and inherited Entity-bound placements', () => {
        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [
                    { widget: { widget_key: 'marketing.navigation', zone: 'marketing-header' }, config: navigationConfig, isActive: true }
                ],
                baseWidgets: [
                    { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: navigationConfig }
                ],
                sourceOverrides: [],
                copyOverrides: true,
                copyMode: undefined
            })
        ).toThrow('Choose how to copy Entity-bound placements')
    })

    it('omits every direct bound placement and reports inherited widgets for tombstones', () => {
        const preparedWidget = {
            widget: { widget_key: 'marketing.navigation', zone: 'marketing-header' },
            config: navigationConfig,
            isActive: true
        }
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [preparedWidget],
            baseWidgets: [
                { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: navigationConfig }
            ],
            sourceOverrides: [],
            copyOverrides: true,
            copyMode: 'omit'
        })

        expect(result.boundWidgets).toEqual(new Set([preparedWidget]))
        expect(result.boundInheritedWidgets).toEqual(new Set(['base-navigation']))
        expect(result.preparedWidgets).toEqual([])
    })

    it('reuses the complete registry binding envelope without changing its semantic source', () => {
        const preparedWidget = {
            widget: { widget_key: 'marketing.navigation', zone: 'marketing-header' },
            config: navigationConfig,
            isActive: true
        }
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [preparedWidget],
            baseWidgets: [],
            sourceOverrides: [],
            copyOverrides: true,
            copyMode: 'reuse'
        })

        expect(result.preparedWidgets).toEqual([preparedWidget])
        expect(result.boundWidgets).toEqual(new Set([preparedWidget]))
    })

    it('rejects reuse of direct bound widget rows owned by a Marketing overlay', () => {
        const preparedWidget = {
            widget: { widget_key: 'marketing.navigation', zone: 'marketing-header' },
            config: navigationConfig,
            isActive: true
        }

        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [preparedWidget],
                baseWidgets: [],
                sourceOverrides: [],
                copyOverrides: true,
                copyMode: 'reuse',
                isOverlayLayout: true
            })
        ).toThrow('Overlay copies cannot own Entity bindings for source-managed placements')

        expect(
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [preparedWidget],
                baseWidgets: [],
                sourceOverrides: [],
                copyOverrides: true,
                copyMode: 'omit',
                isOverlayLayout: true
            }).preparedWidgets
        ).toEqual([])
    })

    it('does not classify a deleted inherited override as a binding to reuse or omit', () => {
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [],
            baseWidgets: [
                { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: navigationConfig }
            ],
            sourceOverrides: [{ base_widget_id: 'base-navigation', is_deleted_override: true }],
            copyOverrides: true,
            copyMode: undefined
        })

        expect(result.boundInheritedWidgets.size).toBe(0)
        expect(result.sourceOverrideByWidgetId.get('base-navigation')?.is_deleted_override).toBe(true)
    })

    it('classifies against the base when overrides will not be copied, even if the source overlay tombstones that widget', () => {
        const result = resolveLayoutCopyBindings({
            templateKey: 'marketing-page',
            preparedWidgets: [],
            baseWidgets: [
                { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: navigationConfig }
            ],
            sourceOverrides: [{ base_widget_id: 'base-navigation', is_deleted_override: true }],
            copyOverrides: false,
            copyMode: 'omit'
        })

        expect(result.boundInheritedWidgets).toEqual(new Set(['base-navigation']))
    })

    it('rejects an override whose base widget is not owned by the copied layout base', () => {
        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [],
                baseWidgets: [
                    { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: navigationConfig }
                ],
                sourceOverrides: [{ base_widget_id: 'foreign-base-widget', config: navigationConfig }],
                copyOverrides: true,
                copyMode: 'reuse'
            })
        ).toThrow('Layout widget override ownership is invalid')
    })

    it('rejects malformed inherited binding configuration before the copy transaction writes', () => {
        expect(() =>
            resolveLayoutCopyBindings({
                templateKey: 'marketing-page',
                preparedWidgets: [],
                baseWidgets: [
                    { id: 'base-navigation', widget_key: 'marketing.navigation', zone: 'marketing-header', config: { malformed: true } }
                ],
                sourceOverrides: [],
                copyOverrides: true,
                copyMode: 'reuse'
            })
        ).toThrow(/Layout widget configuration is invalid/)
    })
})
