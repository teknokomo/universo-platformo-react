import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { APPLICATION_TEMPLATE_REGISTRY } from '../common/applicationTemplates'
import { resolveWidgetBindingSlotDefinition, validateWidgetBindings } from '../common/widgetBindings'
import {
    DASHBOARD_WIDGET_CONFIG_SCHEMAS,
    DASHBOARD_LAYOUT_WIDGET_REGISTRY,
    DASHBOARD_LAYOUT_WIDGETS,
    createTargetDefaultSchema,
    dashboardWidgetConfigSchemaByKey,
    dashboardWidgetRegistrySchema,
    getDashboardWidgetDefinition,
    relationBuilderPanelSchema
} from '../common/dashboardWidgetRegistry'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    canAddApplicationLayoutWidget,
    getLayoutWidgetDefinition,
    layoutWidgetMetadataResponseSchema,
    type LayoutWidgetDefinition
} from '../common/layoutWidgetDefinitions'
import { effectiveWidgetRuntimeDataSchema } from '../common/effectiveWidgetRuntimeData'

const retainedDashboardKeys = [
    'workspaceSwitcher',
    'divider',
    'menuWidget',
    'spacer',
    'infoCard',
    'userProfile',
    'appNavbar',
    'header',
    'breadcrumbs',
    'search',
    'datePicker',
    'optionsMenu',
    'languageSwitcher',
    'colorModeSwitcher',
    'overviewTitle',
    'overviewCards',
    'sessionsChart',
    'pageViewsChart',
    'detailsTitle',
    'detailsTable',
    'relationBuilder',
    'columnsContainer',
    'detailsTabs',
    'interpretationNetworkWorkspace',
    'quizWidget',
    'playcanvasCanvas',
    'resourcePreview',
    'learnerPlayer',
    'footer'
].sort()

const readPath = (value: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
        return (current as Record<string, unknown>)[segment]
    }, value)

const getLocaleMessages = (locale: 'en' | 'ru'): Record<string, unknown> => {
    const path = fileURLToPath(new URL(`../../../../packages/universo-react-i18n/src/locales/${locale}/core/common.json`, import.meta.url))
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

type OwnershipInventoryRow = {
    widgetKey: string
    currentPath: string
    semanticPurpose: string
    finalOwner: string
    finalContractLocation: string
    validationDisposition: string
    copyBehavior: string
    requiredTests: string
    currentSource: string
}

const splitMarkdownTableRow = (line: string): string[] => {
    const columns: string[] = []
    let column = ''

    for (let index = 1; index < line.length - 1; ) {
        const character = line[index]
        if (character === '\\' && line[index + 1] === '|') {
            column += '|'
            index += 2
        } else if (character === '|') {
            columns.push(column.trim())
            column = ''
            index += 1
        } else {
            column += character
            index += 1
        }
    }

    columns.push(column.trim())
    return columns
}

const getOwnershipInventory = (): { documentedRowCount: number; rows: OwnershipInventoryRow[] } => {
    const path = fileURLToPath(
        new URL('../../../../memory-bank/research/dashboard-complete-entity-backed-widgets-field-ownership-2026-10-02.md', import.meta.url)
    )
    const lines = readFileSync(path, 'utf8').split('\n')
    const tableStart = lines.findIndex((line) => /^\|\s*Widget key\s*\|/u.test(line))
    if (tableStart < 0) throw new Error('The Dashboard field ownership table is missing.')

    const headers = splitMarkdownTableRow(lines[tableStart])
    const expectedHeaders = [
        'Widget key',
        'Current persisted field/path',
        'Semantic purpose',
        'Final owner',
        'Final contract location',
        'Validation disposition',
        'Copy behavior',
        'Required tests',
        'Current source'
    ]
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
        throw new Error('The Dashboard field ownership table must keep its nine documented columns in order.')
    }

    const selfCheck = lines.find((line) => line.includes('Inventory self-check:'))
    const documentedRowCount = selfCheck?.match(/Inventory self-check:\s*(\d+) data rows/u)?.[1]
    if (!documentedRowCount) throw new Error('The Dashboard field ownership inventory self-check row count is missing.')

    const rows: OwnershipInventoryRow[] = []
    for (const line of lines.slice(tableStart + 2)) {
        if (!line.startsWith('|')) break
        const columns = splitMarkdownTableRow(line)
        if (columns.length !== expectedHeaders.length) {
            throw new Error(`Expected nine ownership columns, received ${columns.length}.`)
        }
        rows.push({
            widgetKey: columns[0],
            currentPath: columns[1],
            semanticPurpose: columns[2],
            finalOwner: columns[3],
            finalContractLocation: columns[4],
            validationDisposition: columns[5],
            copyBehavior: columns[6],
            requiredTests: columns[7],
            currentSource: columns[8]
        })
    }

    return { documentedRowCount: Number(documentedRowCount), rows }
}

const getStrictObjectKeys = (schema: unknown, visited = new Set<object>()): string[] => {
    if (!schema || typeof schema !== 'object' || visited.has(schema)) return []
    visited.add(schema)

    const candidate = schema as {
        shape?: Record<string, unknown>
        options?: unknown[]
        _def?: { schema?: unknown; options?: unknown[] }
    }
    const keys = new Set(Object.keys(candidate.shape ?? {}))
    const nestedSchemas = [candidate._def?.schema, ...(candidate.options ?? []), ...(candidate._def?.options ?? [])]
    for (const nestedSchema of nestedSchemas) {
        for (const key of getStrictObjectKeys(nestedSchema, visited)) keys.add(key)
    }
    return [...keys]
}

const getSchemaLeafPaths = (schema: unknown, prefix = ''): string[] => {
    if (!schema || typeof schema !== 'object') return prefix ? [prefix] : []

    const candidate = schema as {
        shape?: Record<string, unknown>
        _def?: {
            typeName?: string
            innerType?: unknown
            schema?: unknown
            type?: unknown
            valueType?: unknown
            options?: unknown[]
            optionsMap?: Map<unknown, unknown>
            left?: unknown
            right?: unknown
        }
    }
    const definition = candidate._def

    if (definition?.typeName === 'ZodObject') {
        return Object.entries(candidate.shape ?? {}).flatMap(([key, child]) => getSchemaLeafPaths(child, prefix ? `${prefix}.${key}` : key))
    }
    if (definition?.typeName === 'ZodArray' && definition.type) {
        return getSchemaLeafPaths(definition.type, `${prefix}[]`)
    }
    if (definition?.typeName === 'ZodRecord' && definition.valueType) {
        return getSchemaLeafPaths(definition.valueType, `${prefix}.*`)
    }
    if (definition?.typeName === 'ZodUnion' && definition.options) {
        return definition.options.flatMap((option) => getSchemaLeafPaths(option, prefix))
    }
    if (definition?.typeName === 'ZodDiscriminatedUnion' && definition.optionsMap) {
        return [...definition.optionsMap.values()].flatMap((option) => getSchemaLeafPaths(option, prefix))
    }
    if (definition?.typeName === 'ZodIntersection') {
        return [...getSchemaLeafPaths(definition.left, prefix), ...getSchemaLeafPaths(definition.right, prefix)]
    }
    if (definition?.innerType) return getSchemaLeafPaths(definition.innerType, prefix)
    if (definition?.schema) return getSchemaLeafPaths(definition.schema, prefix)

    return prefix ? [prefix] : []
}

const pathCovers = (ownerPath: string, schemaPath: string): boolean =>
    schemaPath === ownerPath ||
    schemaPath.startsWith(`${ownerPath}.`) ||
    schemaPath.startsWith(`${ownerPath}[]`) ||
    schemaPath.startsWith(`${ownerPath}.*`)

const collectWidgetTranslationKeys = (): string[] => {
    const keys = new Set<string>()
    const collectSlot = (slot: {
        authoring: {
            labelKey?: string
            placeholderKey?: string
            helperTextKey?: string
            emptyOptionsKey?: string
            loadingOptionsKey?: string
        }
    }) => {
        for (const field of ['labelKey', 'placeholderKey', 'helperTextKey', 'emptyOptionsKey', 'loadingOptionsKey']) {
            const key = slot.authoring[field]
            if (key) keys.add(key)
        }
    }

    for (const widget of DASHBOARD_LAYOUT_WIDGETS) {
        keys.add(widget.labelKey)
        for (const field of widget.presentationFields) {
            keys.add(field.labelKey)
            if (field.helperTextKey) keys.add(field.helperTextKey)
            for (const option of field.options ?? []) keys.add(option.labelKey)
        }
        for (const slot of widget.bindingSlots ?? []) collectSlot(slot)
        for (const slots of Object.values(widget.bindingVariants ?? {})) {
            for (const slot of slots) collectSlot(slot)
        }
    }

    return [...keys].sort()
}

describe('canonical Dashboard widget registry', () => {
    it('allows only self-contained structural additions to application-owned layouts', () => {
        const definition = (key: string, config?: Record<string, unknown>) => getLayoutWidgetDefinition(key, config)

        expect(canAddApplicationLayoutWidget(definition('divider'), 'application')).toBe(true)
        expect(canAddApplicationLayoutWidget(definition('spacer'), 'application')).toBe(true)
        expect(canAddApplicationLayoutWidget(definition('workspaceSwitcher'), 'application')).toBe(false)
        expect(canAddApplicationLayoutWidget(definition('columnsContainer'), 'application')).toBe(false)
        expect(canAddApplicationLayoutWidget(definition('menuWidget', { variant: 'generated' }), 'application')).toBe(false)
        expect(canAddApplicationLayoutWidget(definition('detailsTable', { variant: 'report' }), 'application')).toBe(false)
        expect(canAddApplicationLayoutWidget(definition('divider'), 'metahub')).toBe(false)
        expect(canAddApplicationLayoutWidget(undefined, 'application')).toBe(false)

        const workspaceSwitcher = definition('workspaceSwitcher')
        if (!workspaceSwitcher) throw new Error('Workspace switcher definition is required for the policy test.')
        const explicitlyGranted: LayoutWidgetDefinition = {
            ...workspaceSwitcher,
            authoring: {
                ...workspaceSwitcher.authoring,
                application: { ...workspaceSwitcher.authoring.application, canAdd: true }
            }
        }
        expect(canAddApplicationLayoutWidget(explicitlyGranted, 'application')).toBe(false)
        expect(canAddApplicationLayoutWidget(explicitlyGranted, 'metahub')).toBe(false)

        const divider = definition('divider')
        const relationBuilder = definition('relationBuilder')
        if (!divider || !relationBuilder) throw new Error('Structural and dynamic binding definitions are required for the policy test.')
        const structuralWithDynamicBindings: LayoutWidgetDefinition = {
            ...divider,
            bindingSlotFamilies: relationBuilder.bindingSlotFamilies
        }
        expect(canAddApplicationLayoutWidget(structuralWithDynamicBindings, 'application')).toBe(false)
    })

    it('keeps retained registry keys, strict schemas, and public metadata aligned', () => {
        expect(DASHBOARD_LAYOUT_WIDGETS).toBe(DASHBOARD_LAYOUT_WIDGET_REGISTRY)
        expect(DASHBOARD_LAYOUT_WIDGETS.map(({ key }) => key).sort()).toEqual(retainedDashboardKeys)
        expect(Object.keys(dashboardWidgetConfigSchemaByKey).sort()).toEqual(retainedDashboardKeys)
        expect(dashboardWidgetRegistrySchema.safeParse(DASHBOARD_LAYOUT_WIDGETS).success).toBe(true)
        const invalidInitialVariant = DASHBOARD_LAYOUT_WIDGETS.map((widget) =>
            widget.key === 'detailsTable' ? { ...widget, initialBindingVariantKey: 'undeclared' } : widget
        )
        expect(dashboardWidgetRegistrySchema.safeParse(invalidInitialVariant).success).toBe(false)

        for (const retiredKey of ['brandSelector', 'productTree', 'usersByCountryChart']) {
            expect(getDashboardWidgetDefinition(retiredKey)).toBeUndefined()
            expect(dashboardWidgetConfigSchemaByKey).not.toHaveProperty(retiredKey)
        }

        for (const widget of DASHBOARD_LAYOUT_WIDGETS) {
            expect(widget.identity.instanceKey, widget.key).toBe('required')
            expect(widget.sourcePolicy, widget.key).toBeDefined()
            expect(widget.authoring, widget.key).toBeDefined()
            expect(widget.copyPolicy, widget.key).toHaveProperty('placement')
            expect(widget.copyPolicy, widget.key).toHaveProperty('binding')
            expect(widget.placementPolicy, widget.key).toBeDefined()
            expect(widget.capabilities, widget.key).not.toHaveLength(0)
            expect(widget.seedPolicies, widget.key).not.toHaveLength(0)
            expect(dashboardWidgetConfigSchemaByKey[widget.key].safeParse({ instanceKey: widget.key }).success, widget.key).toBe(false)
            expect(
                dashboardWidgetConfigSchemaByKey[widget.key].safeParse({ inventoriedLegacyContent: { records: [] } }).success,
                widget.key
            ).toBe(false)

            const schemaKeys = getStrictObjectKeys(DASHBOARD_WIDGET_CONFIG_SCHEMAS[widget.key]).sort()
            const ownedKeys = [...new Set((widget.configFields ?? []).map(({ path }) => path.split(/[.[]/u)[0]))].sort()
            expect(schemaKeys, `${widget.key} strict schema keys must have one registry owner`).toEqual(ownedKeys)

            const schemaPaths = getSchemaLeafPaths(DASHBOARD_WIDGET_CONFIG_SCHEMAS[widget.key])
            const ownerPaths = (widget.configFields ?? []).map(({ path }) => path)
            const unownedSchemaPaths = [...new Set(schemaPaths)].filter(
                (schemaPath) => ownerPaths.filter((ownerPath) => pathCovers(ownerPath, schemaPath)).length !== 1
            )
            const staleOwnerPaths = ownerPaths.filter((ownerPath) => !schemaPaths.some((schemaPath) => pathCovers(ownerPath, schemaPath)))
            expect(unownedSchemaPaths, `${widget.key} strict schema paths must have exactly one registry owner`).toEqual([])
            expect(staleOwnerPaths, `${widget.key} registry owners must describe strict schema paths`).toEqual([])
        }

        const dashboardDefinitions = LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.templateKey === 'dashboard')
        expect(dashboardDefinitions).toHaveLength(DASHBOARD_LAYOUT_WIDGETS.length)
        expect(dashboardDefinitions.map(({ key }) => key).sort()).toEqual(retainedDashboardKeys)
        expect(
            layoutWidgetMetadataResponseSchema.safeParse({
                items: [...DASHBOARD_LAYOUT_WIDGETS],
                templates: [
                    {
                        ...APPLICATION_TEMPLATE_REGISTRY.dashboard,
                        zones: LAYOUT_ZONE_DEFINITIONS.filter(({ templateKey }) => templateKey === 'dashboard'),
                        widgets: [...DASHBOARD_LAYOUT_WIDGETS]
                    }
                ]
            }).success
        ).toBe(true)
    })

    it('covers retained and retired widget keys from the ownership inventory', () => {
        const retiredKeys = ['brandSelector', 'productTree', 'usersByCountryChart']
        const { documentedRowCount, rows: inventoryRows } = getOwnershipInventory()
        const inventoryWidgetKeys = new Set(inventoryRows.map(({ widgetKey }) => widgetKey))
        const allowedOwners = new Set(['entity', 'binding', 'placement', 'presentation', 'host-runtime', 'specialized-runtime', 'retired'])
        const uniquePaths = new Set<string>()

        expect(inventoryRows).not.toHaveLength(0)
        expect(inventoryRows).toHaveLength(documentedRowCount)
        expect(
            inventoryRows.every(
                ({
                    widgetKey,
                    currentPath,
                    semanticPurpose,
                    finalOwner,
                    finalContractLocation,
                    validationDisposition,
                    copyBehavior,
                    requiredTests,
                    currentSource
                }) => {
                    const uniquePath = `${widgetKey}\u0000${currentPath}`
                    const isUnique = !uniquePaths.has(uniquePath)
                    uniquePaths.add(uniquePath)
                    return (
                        widgetKey.length > 0 &&
                        currentPath.length > 0 &&
                        semanticPurpose.length > 0 &&
                        allowedOwners.has(finalOwner) &&
                        finalContractLocation.length > 0 &&
                        validationDisposition.length > 0 &&
                        copyBehavior.length > 0 &&
                        requiredTests.length > 0 &&
                        currentSource.length > 0 &&
                        isUnique
                    )
                }
            )
        ).toBe(true)

        expect(retainedDashboardKeys.every((key) => inventoryWidgetKeys.has(key))).toBe(true)
        for (const retiredKey of retiredKeys) {
            expect(
                inventoryRows.some(
                    ({ widgetKey, currentPath, finalOwner }) =>
                        widgetKey === retiredKey && currentPath.length > 0 && finalOwner === 'retired'
                )
            ).toBe(true)
        }
        expect([...retainedDashboardKeys, ...retiredKeys].every((key) => inventoryWidgetKeys.has(key))).toBe(true)

        const escapedPipeRow = inventoryRows.find(
            ({ widgetKey, currentPath }) =>
                widgetKey === 'detailsTable' && currentPath.startsWith('config.datasource.query.lifecycleState ')
        )
        expect(escapedPipeRow?.currentPath).toContain('[records.list|records.union|ledger.facts]')
        expect(escapedPipeRow?.finalOwner).toBe('binding')
    })

    it('keeps Marketing ownership metadata and stored identity rules available in the generic registry', () => {
        const marketingDefinitions = LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.templateKey === 'marketing-page')
        expect(marketingDefinitions.length).toBeGreaterThan(0)
        for (const widget of marketingDefinitions) {
            expect(widget.identity.instanceKey, widget.key).toBe('required')
            expect(widget.sourcePolicy, widget.key).toBeDefined()
            expect(widget.copyPolicy, widget.key).toHaveProperty('binding')
            expect(widget.authoring, widget.key).toBeDefined()
        }
    })

    it('matches container descriptor prefixes to semantic child slot keys', () => {
        const columnConfig = DASHBOARD_WIDGET_CONFIG_SCHEMAS.columnsContainer
        const tabConfig = DASHBOARD_WIDGET_CONFIG_SCHEMAS.detailsTabs

        expect(columnConfig.safeParse({ columns: [{ slotKey: 'column:primary', width: 6 }] }).success).toBe(true)
        expect(columnConfig.safeParse({ columns: [{ slotKey: 'primary', width: 6 }] }).success).toBe(false)
        expect(columnConfig.safeParse({ columns: [{ slotKey: 'tab:primary', width: 6 }] }).success).toBe(false)
        expect(tabConfig.safeParse({ tabs: [{ slotKey: 'tab:overview', label: 'Overview' }] }).success).toBe(true)
        expect(tabConfig.safeParse({ tabs: [{ slotKey: 'overview', label: 'Overview' }] }).success).toBe(false)
        expect(tabConfig.safeParse({ tabs: [{ slotKey: 'column:overview', label: 'Overview' }] }).success).toBe(false)

        for (const [widgetKey, descriptorKey] of [
            ['columnsContainer', 'column:primary'],
            ['detailsTabs', 'tab:overview']
        ] as const) {
            const slot = getDashboardWidgetDefinition(widgetKey)?.composition?.container?.slots[0]
            expect(slot).toBeDefined()
            expect(descriptorKey.startsWith(slot!.slotPrefix)).toBe(true)
            expect(new RegExp(slot!.slotKeyPattern, 'u').test(descriptorKey.slice(slot!.slotPrefix.length))).toBe(true)
        }
    })

    it('rejects undeclared shell, embedded-menu and non-rendered info-card configuration', () => {
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.appNavbar.safeParse({}).success).toBe(true)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.appNavbar.safeParse({ mobileMode: 'drawer' }).success).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.header.safeParse({ size: 'large' }).success).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget.safeParse({}).success).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget.safeParse({ variant: 'generated' }).success).toBe(true)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget.safeParse({ variant: 'generated', maxVisibleItems: 8 }).success).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget.safeParse({ variant: 'manual', projection: 'compact' }).success).toBe(false)
        expect(
            DASHBOARD_WIDGET_CONFIG_SCHEMAS.menuWidget.safeParse({ variant: 'manual', items: [{ title: 'Embedded copy' }] }).success
        ).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.infoCard.safeParse({ severity: 'warning' }).success).toBe(true)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.infoCard.safeParse({ icon: 'warning' }).success).toBe(false)
        expect(DASHBOARD_WIDGET_CONFIG_SCHEMAS.infoCard.safeParse({ actionStyle: 'primary' }).success).toBe(false)
    })

    it('declares semantic content identity, metric display projection, and LMS row ordering', () => {
        const infoCard = getDashboardWidgetDefinition('infoCard')
        const contentSlot = infoCard?.bindingSlots?.find(({ key }) => key === 'content')
        expect(contentSlot?.selectorKinds).toEqual(['semantic-key'])
        expect(contentSlot?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: 'key',
                    componentCodename: 'Key',
                    valueType: 'string',
                    localized: false,
                    required: true,
                    semanticKey: true,
                    pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'
                })
            ])
        )
        if (!infoCard || !contentSlot) throw new Error('The infoCard content binding contract is missing.')
        const projection = contentSlot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        expect(
            validateWidgetBindings(infoCard, {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'DashboardContent',
                                selector: { kind: 'semantic-key', field: 'key', value: 'overview' },
                                projection
                            }
                        ]
                    }
                ]
            }).slots
        ).toHaveLength(1)

        const metrics = getDashboardWidgetDefinition('overviewCards')?.bindingSlots?.find(({ key }) => key === 'metrics')
        expect(metrics).toMatchObject({ maxResolvedRecords: 12, orderByField: 'order' })
        expect(metrics?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'metricKey', componentCodename: 'MetricKey', semanticKey: true }),
                expect.objectContaining({ field: 'title', componentCodename: 'Title', localized: true, required: true }),
                expect.objectContaining({ field: 'interval', componentCodename: 'Interval', localized: true, required: false }),
                expect.objectContaining({ field: 'value', componentCodename: 'Value', valueType: 'number', required: true }),
                expect.objectContaining({ field: 'order', componentCodename: 'Order', valueType: 'number' })
            ])
        )

        const rows = getDashboardWidgetDefinition('detailsTable')?.bindingSlots?.find(({ key }) => key === 'rows')
        expect(getLayoutWidgetDefinition('detailsTable')?.initialBindingVariantKey).toBe('records')
        expect(rows).toMatchObject({
            projectionMode: 'entity-schema',
            selectorKinds: ['record-set'],
            maxResolvedRecords: 500,
            requirements: { components: [] }
        })
        expect(rows).not.toHaveProperty('orderByField')

        const learnerEnrollmentTable = getLayoutWidgetDefinition('detailsTable', { variant: 'learner-enrollments' })
        const learnerEnrollmentRows = learnerEnrollmentTable?.bindingSlots?.find(({ key }) => key === 'rows')
        expect(learnerEnrollmentTable).toMatchObject({
            sourcePolicy: { sourceMode: 'required', inheritBindings: true },
            authoring: { metahub: { canRebind: false }, application: { canRebind: false } },
            copyPolicy: { placement: 'copy', binding: 'share-bindings' }
        })
        expect(learnerEnrollmentRows).toMatchObject({
            selectorKinds: ['learner-enrollment-set'],
            maxResolvedRecords: 100,
            orderByField: 'title',
            requirements: { entityCodenames: ['Enrollments'] }
        })
        expect(dashboardWidgetConfigSchemaByKey.detailsTable.safeParse({ variant: 'learner-enrollments', maxRows: 24 }).success).toBe(true)
        expect(
            dashboardWidgetConfigSchemaByKey.detailsTable.safeParse({
                variant: 'learner-enrollments',
                targetFilters: [{ field: 'AssignedUserId', value: 'currentUserId' }]
            }).success
        ).toBe(false)

        const menuItems = getLayoutWidgetDefinition('menuWidget', { variant: 'manual' })?.bindingSlots?.find(({ key }) => key === 'items')
        expect(menuItems).toMatchObject({ maxResolvedRecords: 100, orderByField: 'order', cardinality: { min: 1, max: 1 } })

        const manualMenu = getLayoutWidgetDefinition('menuWidget', { variant: 'manual' })
        const menuHeading = manualMenu?.bindingSlots?.find(({ key }) => key === 'heading')
        expect(menuHeading).toMatchObject({
            selectorKinds: ['semantic-key'],
            cardinality: { min: 0, max: 1 },
            requirements: {
                entityKinds: ['object'],
                components: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'key',
                        componentCodename: 'Key',
                        semanticKey: true,
                        localized: false,
                        required: true
                    }),
                    expect.objectContaining({ field: 'title', componentCodename: 'Title', localized: true, required: true })
                ])
            }
        })
        if (!manualMenu || !menuItems || !menuHeading) throw new Error('The manual menu binding contract is incomplete.')
        const itemProjection = menuItems.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        const headingProjection = menuHeading.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        const validMenuBindings = {
            version: 1,
            slots: [
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: 'object' as const,
                            entityCodename: 'MenuItems',
                            selector: { kind: 'record-set' as const },
                            projection: itemProjection
                        }
                    ]
                },
                {
                    slot: 'heading',
                    targets: [
                        {
                            entityKind: 'object' as const,
                            entityCodename: 'MenuHeadings',
                            selector: { kind: 'semantic-key' as const, field: 'key', value: 'main-navigation' },
                            projection: headingProjection
                        }
                    ]
                }
            ]
        }
        expect(validateWidgetBindings(manualMenu, validMenuBindings).slots).toHaveLength(2)
        expect(() =>
            validateWidgetBindings(manualMenu, {
                ...validMenuBindings,
                slots: [
                    validMenuBindings.slots[0],
                    {
                        ...validMenuBindings.slots[1],
                        targets: [{ ...validMenuBindings.slots[1].targets[0], entityKind: 'page' as const }]
                    }
                ]
            })
        ).toThrow()

        const relationBuilder = getDashboardWidgetDefinition('relationBuilder')
        const relationPanel = relationBuilder ? resolveWidgetBindingSlotDefinition(relationBuilder, 'panel:materials') : undefined
        expect(relationPanel).toMatchObject({
            selectorKinds: ['relation-set'],
            maxResolvedRecords: 500,
            orderByField: 'order',
            relation: { field: 'parent', parentSlot: 'parent' }
        })
        expect(relationPanel?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'parent', componentCodename: 'Parent', valueType: 'ref' }),
                expect.objectContaining({ field: 'title', componentCodename: 'Title', localized: true }),
                expect.objectContaining({ field: 'order', componentCodename: 'SortOrder', valueType: 'number' })
            ])
        )

        const unconfiguredRelationBuilder = getLayoutWidgetDefinition('relationBuilder', {})
        expect(unconfiguredRelationBuilder?.bindingSlots?.map(({ key }) => key)).toEqual(['parent', 'panel'])
        expect(resolveWidgetBindingSlotDefinition(unconfiguredRelationBuilder!, 'panel:materials')).toMatchObject({
            key: 'panel:materials',
            relation: { field: 'parent', parentSlot: 'parent' }
        })

        const courseRelationBuilder = getLayoutWidgetDefinition('relationBuilder', {
            parentTitleFieldCodename: 'Title',
            panels: [
                {
                    slotKey: 'panel:items',
                    title: 'Course items',
                    parentFieldCodename: 'CourseId',
                    sortOrderFieldCodename: 'SortOrder',
                    displayFields: [{ fieldCodename: 'Category', valueType: 'string', localized: true, required: false }]
                }
            ]
        })
        expect(courseRelationBuilder?.bindingSlots?.map(({ key }) => key)).toEqual(['parent', 'panel:items'])
        expect(courseRelationBuilder?.bindingSlotFamilies).toBeUndefined()
        expect(courseRelationBuilder?.bindingSlots?.find(({ key }) => key === 'panel:items')?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'parent', componentCodename: 'CourseId', valueType: 'ref' }),
                expect.objectContaining({ field: 'title', componentCodename: 'Title', localized: true }),
                expect.objectContaining({ field: 'order', componentCodename: 'SortOrder', valueType: 'number' }),
                expect.objectContaining({
                    field: 'display1',
                    componentCodename: 'Category',
                    valueType: 'string',
                    localized: true,
                    required: false
                })
            ])
        )

        const trackRelationBuilder = getLayoutWidgetDefinition('relationBuilder', {
            panels: [
                {
                    slotKey: 'panel:steps',
                    title: 'Track steps',
                    parentFieldCodename: 'TrackId'
                }
            ]
        })
        expect(trackRelationBuilder?.bindingSlots?.find(({ key }) => key === 'panel:steps')?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'parent', componentCodename: 'TrackId', valueType: 'ref' }),
                expect.objectContaining({ field: 'order', componentCodename: 'SortOrder', valueType: 'number' })
            ])
        )

        const learnerPlayer = getDashboardWidgetDefinition('learnerPlayer')
        expect(getLayoutWidgetDefinition('learnerPlayer')?.initialBindingVariantKey).toBe('course')
        const learnerItems = learnerPlayer?.bindingSlots?.find(({ key }) => key === 'items')
        expect(learnerItems).toMatchObject({
            selectorKinds: ['relation-set'],
            maxResolvedRecords: 100,
            orderByField: 'order',
            relation: { field: 'parent', parentSlot: 'parent' }
        })
        expect(learnerItems?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'title', componentCodename: 'Title', localized: true }),
                expect.objectContaining({ field: 'targetObjectCodename', componentCodename: 'TargetObjectCodename', valueType: 'string' }),
                expect.objectContaining({ field: 'targetRecordId', componentCodename: 'TargetRecordId', valueType: 'string' })
            ])
        )
        expect(learnerItems?.requirements.components.some(({ componentCodename }) => componentCodename === 'BlockContent')).toBe(false)
        expect(learnerPlayer?.bindingVariants?.course?.find(({ key }) => key === 'items')?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'parent', componentCodename: 'CourseId', valueType: 'ref' }),
                expect.objectContaining({ field: 'targetObjectCodename', componentCodename: 'TargetObjectCodename' }),
                expect.objectContaining({ field: 'targetRecordId', componentCodename: 'TargetRecordId' })
            ])
        )
        expect(learnerPlayer?.bindingVariants?.track?.find(({ key }) => key === 'items')?.requirements.components).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'parent', componentCodename: 'TrackId', valueType: 'ref' }),
                expect.objectContaining({ field: 'targetRecordId', componentCodename: 'CourseId', valueType: 'ref' })
            ])
        )
    })

    it('exports typed create defaults, relation panels, and the specialized PlayCanvas runtime contract', () => {
        expect(createTargetDefaultSchema.safeParse({ fieldCodename: 'displayName', value: 'Member' }).success).toBe(true)
        expect(createTargetDefaultSchema.safeParse({ fieldCodename: 'id', value: 'unsafe' }).success).toBe(false)
        expect(createTargetDefaultSchema.safeParse({ fieldCodename: 'displayName', value: 'x', enumCodename: 'active' }).success).toBe(
            false
        )
        expect(createTargetDefaultSchema.safeParse({ fieldCodename: 'displayName', contextPath: 'user.__proto__.name' }).success).toBe(
            false
        )

        expect(
            relationBuilderPanelSchema.safeParse({
                slotKey: 'panel:materials',
                title: 'Materials',
                parentFieldCodename: 'parent',
                displayFields: [{ fieldCodename: 'Category', valueType: 'string', localized: true, required: false }],
                createDefaults: [{ fieldCodename: 'status', enumCodename: 'draft' }],
                createWizard: {
                    steps: [{ id: 'details', label: 'Details', fieldCodenames: ['name'] }]
                }
            }).success
        ).toBe(true)
        expect(
            relationBuilderPanelSchema.safeParse({
                slotKey: 'panel:materials',
                title: 'Materials',
                parentFieldCodename: 'parent',
                datasource: { kind: 'records.list' }
            }).success
        ).toBe(false)

        const relationPanelBase = { slotKey: 'panel:items', title: 'Items', parentFieldCodename: 'Parent' }
        expect(
            relationBuilderPanelSchema.safeParse({
                ...relationPanelBase,
                displayFields: Array.from({ length: 9 }, (_, index) => ({
                    fieldCodename: `Display${index + 1}`,
                    valueType: 'string',
                    localized: false,
                    required: false
                }))
            }).success
        ).toBe(false)
        expect(
            relationBuilderPanelSchema.safeParse({
                ...relationPanelBase,
                displayFields: [
                    { fieldCodename: 'Category', valueType: 'string', localized: false, required: false, label: 'Untrusted label' }
                ]
            }).success
        ).toBe(false)
        expect(
            relationBuilderPanelSchema.safeParse({
                ...relationPanelBase,
                displayFields: [{ fieldCodename: 'ParentId', valueType: 'string', localized: false, required: false }]
            }).success
        ).toBe(false)
        expect(
            relationBuilderPanelSchema.safeParse({
                ...relationPanelBase,
                displayFields: [
                    { fieldCodename: 'Category', valueType: 'string', localized: false, required: false },
                    { fieldCodename: 'Category', valueType: 'string', localized: false, required: false }
                ]
            }).success
        ).toBe(false)
        expect(
            relationBuilderPanelSchema.safeParse({
                ...relationPanelBase,
                displayFields: [{ fieldCodename: 'Payload', valueType: 'json', localized: false, required: false }]
            }).success
        ).toBe(false)

        const playcanvasConfig = dashboardWidgetConfigSchemaByKey.playcanvasCanvas
        expect(
            playcanvasConfig.safeParse({
                moduleCodename: 'scene-runtime',
                attachedToKind: 'metahub',
                mountMethodName: 'mount',
                runtimeManifest: {
                    source: 'publishedManifest',
                    projectId: '11111111-1111-4111-8111-111111111111',
                    checksum: 'a'.repeat(64)
                },
                scene: {
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 1, y: 1, z: 1 }
                        }
                    ],
                    controlledObjectId: 'ship'
                }
            }).success
        ).toBe(true)
        expect(playcanvasConfig.safeParse({ moduleCodename: 'scene-runtime', instanceKey: 'renderer-identity' }).success).toBe(false)
        expect(playcanvasConfig.safeParse({ moduleCodename: 'scene-runtime', sharedBehavior: { canExclude: true } }).success).toBe(false)
        expect(
            playcanvasConfig.safeParse({
                scene: { objects: [{ id: 'ship' }] }
            }).success
        ).toBe(false)
    })

    it('allowlists relation target versions while rejecting persistence internals', () => {
        const rowHandle = 'rh1.test-course-item-handle'
        const data = {
            status: 'ready',
            data: {
                kind: 'relation',
                parents: [],
                panels: [
                    {
                        slotKey: 'panel:items',
                        title: 'Lessons',
                        targetEntityCodename: 'CourseItems',
                        parentFieldCodename: 'CourseId',
                        displayColumns: [{ key: 'display1', label: 'Category' }],
                        rows: [
                            {
                                key: 'row-1',
                                parentKey: 'parent-1',
                                label: 'Lesson',
                                target: { entityCodename: 'CourseItems', recordHandle: rowHandle, version: 6 },
                                cells: [{ key: 'display1', value: 'Core' }]
                            }
                        ]
                    }
                ]
            }
        }
        expect(effectiveWidgetRuntimeDataSchema.safeParse(data).success).toBe(true)
        expect(
            effectiveWidgetRuntimeDataSchema.safeParse({
                ...data,
                data: {
                    ...data.data,
                    panels: [
                        {
                            ...data.data.panels[0],
                            rows: [
                                {
                                    ...data.data.panels[0].rows[0],
                                    target: { ...data.data.panels[0].rows[0].target, _upl_version: 6 }
                                }
                            ]
                        }
                    ]
                }
            }).success
        ).toBe(false)
    })

    it('requires learner-player items to reference a projected parent', () => {
        const itemRecordHandle = 'rh1.test-course-item-progress-handle'
        const runtimeData = {
            status: 'ready',
            data: {
                kind: 'learner-player',
                parents: [
                    {
                        key: 'course-1',
                        label: 'Course one',
                        target: { entityCodename: 'Courses', recordHandle: 'rh1.test-course-parent-handle' }
                    }
                ],
                items: [
                    {
                        key: 'item-1',
                        parentKey: 'course-1',
                        title: 'Introduction',
                        blocks: [],
                        progressTarget: { objectCodename: 'CourseItems', recordHandle: itemRecordHandle },
                        availability: 'available'
                    }
                ]
            }
        }

        expect(effectiveWidgetRuntimeDataSchema.safeParse(runtimeData).success).toBe(true)
        expect(
            effectiveWidgetRuntimeDataSchema.safeParse({
                ...runtimeData,
                data: { ...runtimeData.data, items: [{ ...runtimeData.data.items[0], parentKey: 'missing-parent' }] }
            }).success
        ).toBe(false)
    })

    it('provides every registry translation key in both common locales', () => {
        const keys = collectWidgetTranslationKeys()
        const missingByLocale = Object.fromEntries(
            (['en', 'ru'] as const).map((locale) => {
                const messages = getLocaleMessages(locale)
                const missingKeys = keys.filter((key) => typeof readPath(messages, `common.${key}`) !== 'string')
                return [locale, missingKeys]
            })
        )
        expect(missingByLocale).toEqual({ en: [], ru: [] })
    })
})
