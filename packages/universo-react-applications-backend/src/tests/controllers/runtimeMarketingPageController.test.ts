import type { Request, Response } from 'express'
import { buildSingleTargetWidgetBinding, getLayoutWidgetDefinition } from '@universo-react/types'
import { createRuntimeMarketingPageController, safeAction, safeMedia, toConfig } from '../../controllers/runtimeMarketingPageController'
import { attachApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789a0'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const physicalWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a6'
const sourceLayoutId = '0190a9b5-3cde-7abc-8def-0123456789a7'
const sourceWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a8'
const sourceBaseWidgetId = '0190a9b5-3cde-7abc-8def-0123456789a9'
const objectId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const userId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789a5'

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')!
const heroSlot = heroDefinition.bindingSlots!.find(({ key }) => key === 'content')!
const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageHero',
    semanticKey: 'default'
})
const heroObject = {
    id: objectId,
    codename: 'MarketingPageHero',
    kind: 'object',
    table_name: 'marketing_page_hero',
    config: {
        capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
        recordPolicy: { version: 1, ...heroSlot.requirements.recordPolicy }
    }
}
const heroComponents = heroSlot.requirements.components.map((requirement, index) => ({
    id: '0190a9b5-3cde-7abc-8def-0123456789' + String(index + 10).padStart(2, '0'),
    object_id: objectId,
    codename: requirement.componentCodename,
    column_name: 'component_' + index,
    data_type: requirement.valueType.toUpperCase(),
    is_required: requirement.required,
    validation_rules: {
        ...(requirement.localized ? { localized: true } : {}),
        ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
        ...(requirement.semanticKey ? { unique: true } : {}),
        ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
        ...(requirement.format ? { format: requirement.format } : {})
    },
    target_object_id: null
}))
const heroContent: Record<string, unknown> = {
    key: 'default',
    title: { en: 'Our latest', ru: 'Наши новые' },
    accent: { en: 'products', ru: 'продукты' },
    description: { en: 'Description', ru: 'Описание' },
    emailLabel: { en: 'Email', ru: 'Почта' },
    emailPlaceholder: { en: 'Your email', ru: 'Ваш email' },
    primaryActionLabel: { en: 'Start now', ru: 'Начать' },
    primaryAction: { kind: 'internal', path: '/sign-up' },
    termsText: { en: 'Terms', ru: 'Условия' },
    termsLinkLabel: { en: 'Terms & Conditions', ru: 'Условиями использования' },
    termsAction: { kind: 'internal', path: '/terms' }
}
const heroDataRow = {
    record_id: recordId,
    ...Object.fromEntries(heroSlot.requirements.components.map((requirement, index) => ['field_' + index, heroContent[requirement.field]]))
}

const imageDefinition = getLayoutWidgetDefinition('marketing.image')!
const imageSlot = imageDefinition.bindingSlots!.find(({ key }) => key === 'content')!
const imageBindings = buildSingleTargetWidgetBinding(imageDefinition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageImage',
    semanticKey: 'default'
})
const imageObject = {
    id: objectId,
    codename: 'MarketingPageImage',
    kind: 'object',
    table_name: 'marketing_page_image',
    config: {
        capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
        recordPolicy: { version: 1, ...imageSlot.requirements.recordPolicy }
    }
}
const imageComponents = imageSlot.requirements.components.map((requirement, index) => ({
    id: '0190a9b5-3cde-7abc-8def-1123456789' + String(index + 10).padStart(2, '0'),
    object_id: objectId,
    codename: requirement.componentCodename,
    column_name: 'image_field_' + index,
    data_type: requirement.valueType.toUpperCase(),
    is_required: requirement.required,
    validation_rules: {
        ...(requirement.localized ? { localized: true } : {}),
        ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
        ...(requirement.semanticKey ? { unique: true } : {}),
        ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
        ...(requirement.format ? { format: requirement.format } : {})
    },
    target_object_id: null
}))
const imageContent: Record<string, unknown> = {
    key: 'default',
    resource: null,
    altText: undefined,
    decorative: true,
    width: 1600,
    height: 900
}
const imageDataRow = {
    record_id: recordId,
    ...Object.fromEntries(
        imageSlot.requirements.components.map((requirement, index) => ['field_' + index, imageContent[requirement.field]])
    )
}

const createResponse = () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { json, status } as unknown as Response & { json: jest.Mock; status: jest.Mock }
}

const layoutWidget = (
    bindings: unknown = heroBindings,
    instanceKey = 'hero',
    sourceIdentity: { sourceWidgetId?: string | null; sourceBaseWidgetId?: string | null } = {}
) => {
    const widget = {
        id: physicalWidgetId,
        layoutId,
        zone: 'marketing-main',
        semanticRegion: 'main',
        widgetKey: 'marketing.hero',
        instanceKey,
        sortOrder: 0,
        config: { instanceKey, showLeadForm: true },
        sourceConfig: null,
        sourceWidgetId: sourceIdentity.sourceWidgetId ?? null,
        sourceBaseWidgetId: sourceIdentity.sourceBaseWidgetId ?? null,
        isActive: true,
        version: 1
    }
    return attachApplicationLayoutWidgetSourceBindingState(widget, {
        persistedApplicationRow: true,
        ...(bindings === undefined ? {} : { bindings: bindings as never })
    })
}

const imageLayoutWidget = () =>
    attachApplicationLayoutWidgetSourceBindingState(
        {
            id: physicalWidgetId,
            layoutId,
            zone: 'marketing-main',
            semanticRegion: 'main',
            widgetKey: 'marketing.image',
            instanceKey: 'hero-image',
            sortOrder: 0,
            config: { instanceKey: 'hero-image' },
            sourceConfig: null,
            sourceWidgetId: null,
            sourceBaseWidgetId: null,
            isActive: true,
            version: 1
        },
        { persistedApplicationRow: true, bindings: imageBindings }
    )

const createRuntimeLayout = (
    widgets = [layoutWidget()],
    scope: 'global' | 'entity' = 'global',
    sourceIdentity: { sourceLayoutId?: string | null; sourceContentHash?: string | null } = {}
) =>
    ({
        status: 'ok',
        target: {},
        resolvedEntityTypeId: null,
        scope,
        layout: {
            id: layoutId,
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'marketing-page',
            sourceKind: 'application',
            sourceLayoutId: sourceIdentity.sourceLayoutId ?? null,
            sourceSnapshotHash: null,
            sourceContentHash: sourceIdentity.sourceContentHash ?? null,
            localContentHash: null,
            syncState: 'clean',
            compositionMode: 'independent',
            baseLayoutId: null,
            name: { en: 'Marketing' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            version: 1
        },
        widgets,
        precedence: ['application-global'],
        publicationIdentity: null,
        materializationHash: 'a'.repeat(64),
        effectiveHash: 'b'.repeat(64)
    } as never)

const createHarness = (
    options: {
        widgets?: ReturnType<typeof layoutWidget>[]
        scope?: 'global' | 'entity'
        object?: Record<string, unknown>
        components?: Array<Record<string, unknown>>
        record?: Record<string, unknown>
        workspaceId?: string | null
        sourceLayoutId?: string | null
        sourceContentHash?: string | null
    } = {}
) => {
    const runtimeObject = options.object ?? heroObject
    const manager = {
        query: jest.fn(async (sql: string) => {
            if (sql.includes('_app_objects')) return [runtimeObject]
            if (sql.includes('_app_components')) return options.components ?? heroComponents
            if (sql.includes(`FROM "app_0190a9b53cde7abc8def0123456789a0"."${String(runtimeObject.table_name)}"`)) {
                return [options.record ?? heroDataRow]
            }
            return []
        })
    }
    const controller = createRuntimeMarketingPageController(() => manager as never, {
        resolveRuntimeContext: async () => ({
            applicationId,
            schemaName: 'app_0190a9b53cde7abc8def0123456789a0',
            schemaIdent: '"app_0190a9b53cde7abc8def0123456789a0"',
            manager: manager as never,
            userId,
            role: 'owner',
            currentWorkspaceId: options.workspaceId ?? null,
            workspacesEnabled: options.workspaceId !== undefined
        }),
        resolveEffectiveLayout: async () =>
            createRuntimeLayout(options.widgets ?? [layoutWidget()], options.scope ?? 'global', {
                sourceLayoutId: options.sourceLayoutId,
                sourceContentHash: options.sourceContentHash
            })
    })
    return { controller, manager }
}

describe('runtime marketing page controller', () => {
    it('filters unsafe actions and media before they reach the runtime payload', () => {
        expect(safeAction('/sign-up')).toMatchObject({ kind: 'internal', path: '/sign-up' })
        expect(safeAction('#')).toBeNull()
        expect(safeAction('javascript:alert(1)')).toBeNull()
        expect(safeAction('https://user:pass@example.test')).toBeNull()
        expect(safeAction('mailto:sales@example.test?subject=Hello%20world')).toEqual({
            kind: 'email',
            address: 'sales@example.test',
            subject: 'Hello world'
        })
        expect(safeAction('mailto:sales@example.test?body=unsafe')).toBeNull()
        expect(safeAction('mailto:sales@example.test?subject=unsafe%0Aheader')).toBeNull()
        expect(safeMedia('https://cdn.example.test/hero.png', 'hero', { en: 'Hero' })).toMatchObject({
            kind: 'hero',
            resource: { url: 'https://cdn.example.test/hero.png' }
        })
        expect(safeMedia({ type: 'url', url: 'javascript:alert(1)' }, 'hero', { en: 'Hero' })).toBeUndefined()
        expect(safeMedia('data:text/plain,unsafe', 'hero', { en: 'Hero' })).toBeUndefined()
    })

    it('normalizes configuration defaults and rejects malformed marketing settings', () => {
        expect(toConfig({})).toMatchObject({ themeMode: 'system', allowEmailActions: true, externalLinkTarget: 'new-tab' })
        expect(() => toConfig({ themeMode: 'sepia' })).toThrow('configuration is invalid')
    })

    it('resolves a published compatible Entity through projected, bounded SQL and omits every record identifier', async () => {
        const { controller, manager } = createHarness()
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.json).toHaveBeenCalledTimes(1)
        const payload = res.json.mock.calls[0]?.[0]
        const hero = payload.marketingPage.widgets.find((widget: { widgetKey: string }) => widget.widgetKey === 'marketing.hero')
        expect(hero.data.records[0]).toMatchObject({
            kind: 'heroContent',
            content: {
                title: { en: 'Our latest', ru: 'Наши новые' },
                primaryAction: { kind: 'internal', path: '/sign-up' }
            }
        })
        expect(JSON.stringify(payload)).not.toContain(recordId)
        expect(JSON.stringify(payload)).not.toContain('MarketingPageHero')
        const recordQuery = manager.query.mock.calls.find(([sql]) =>
            String(sql).includes('FROM "app_0190a9b53cde7abc8def0123456789a0"."marketing_page_hero"')
        )?.[0]
        expect(String(recordQuery)).toContain('"_app_published" = true')
        expect(String(recordQuery)).toContain('LIMIT $2')
        expect(String(recordQuery)).not.toContain('SELECT *')
    })

    it('serializes only renderer freshness metadata and omits physical and source identities', async () => {
        const { controller } = createHarness({
            widgets: [layoutWidget(heroBindings, 'hero', { sourceWidgetId, sourceBaseWidgetId })],
            sourceLayoutId,
            sourceContentHash: 'c'.repeat(64)
        })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        const payload = res.json.mock.calls[0]?.[0]
        const widget = payload.marketingPage.widgets[0]
        expect(payload.marketingPage.runtime).toEqual({ layoutVersion: 1, layoutHash: 'b'.repeat(64) })
        expect(widget).not.toHaveProperty('id')
        expect(widget).not.toHaveProperty('layoutId')
        expect(widget).not.toHaveProperty('sourceWidgetId')
        expect(widget).not.toHaveProperty('sourceBaseWidgetId')
        const serialized = JSON.stringify(payload)
        for (const identity of [layoutId, physicalWidgetId, sourceLayoutId, sourceWidgetId, sourceBaseWidgetId, 'c'.repeat(64)]) {
            expect(serialized).not.toContain(identity)
        }
    })

    it('omits an Entity-backed Image widget while its optional ResourceSource is empty', async () => {
        const { controller } = createHarness({
            widgets: [imageLayoutWidget() as never],
            object: imageObject,
            components: imageComponents,
            record: imageDataRow
        })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { locale: 'en' } } as unknown as Request, res)

        expect(res.status).not.toHaveBeenCalled()
        expect(res.json.mock.calls[0]?.[0].marketingPage.widgets).toEqual([])
    })

    it('rejects missing bindings before reading Entity metadata', async () => {
        const { controller, manager } = createHarness({ widgets: [layoutWidget(null as never)] })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: {} } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(manager.query).not.toHaveBeenCalled()
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MARKETING_LAYOUT_INVALID' }))
    })

    it('allows an intentionally empty independent entity-scoped marketing layout', async () => {
        const { controller } = createHarness({ widgets: [], scope: 'entity' })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: {} } as unknown as Request, res)

        expect(res.status).not.toHaveBeenCalled()
        expect(res.json.mock.calls[0]?.[0].marketingPage.widgets).toEqual([])
    })

    it('still rejects a global marketing layout without an active composition', async () => {
        const { controller } = createHarness({ widgets: [] })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: {} } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'MARKETING_LAYOUT_INCOMPLETE' })
        )
    })

    it('fails closed for an incompatible target without reading its record table', async () => {
        const wrongObject = { ...heroObject, config: {} }
        const { controller, manager } = createHarness({ object: wrongObject })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: {} } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(
            manager.query.mock.calls.some(([sql]) =>
                String(sql).includes('FROM "app_0190a9b53cde7abc8def0123456789a0"."marketing_page_hero"')
            )
        ).toBe(false)
    })

    it('rejects duplicate placement identities before reading Entity metadata', async () => {
        const { controller, manager } = createHarness({
            widgets: [layoutWidget(heroBindings, 'same'), layoutWidget(heroBindings, 'same')]
        })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: {} } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(manager.query).not.toHaveBeenCalled()
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Marketing widget instance keys must be unique within a layout.' })
        )
    })

    it('applies workspace isolation in the runtime record query', async () => {
        const { controller, manager } = createHarness({ workspaceId })
        const res = createResponse()

        await controller.getMarketingPage({ params: { applicationId }, query: { workspaceId } } as unknown as Request, res)

        const [sql, params] =
            manager.query.mock.calls.find(([query]) =>
                String(query).includes('FROM "app_0190a9b53cde7abc8def0123456789a0"."marketing_page_hero"')
            ) ?? []
        expect(String(sql)).toContain('"workspace_id" = $1')
        expect(params).toContain(workspaceId)
    })
})
