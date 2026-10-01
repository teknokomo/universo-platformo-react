const {
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings
} = require('@universo-react/types')
const { WidgetBindingService } = require('./widgetBindingService')

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const objectId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a5'
const sectionObjectId = '0190a9b5-3cde-7abc-8def-0123456789a6'

const localized = (content) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: { content, isActive: true },
        ru: { content, isActive: true }
    }
})

const requirementsPolicy = (slot) => {
    const expected = slot.requirements.recordPolicy
    return {
        version: 1,
        semanticKey: expected?.semanticKey,
        denyDeleteWhenBound: expected?.denyDeleteWhenBound ?? false,
        immutableSemanticKeyWhenBound: expected?.immutableSemanticKeyWhenBound ?? false,
        runtimeMutation: expected?.runtimeMutation ?? 'allow',
        requiredLocales: expected?.requiredLocales,
        coRequiredGroups: expected?.coRequiredGroups,
        conditionalRequired: expected?.conditionalRequired
    }
}

const componentRows = (sourceObjectId, slot, relationTarget) =>
    slot.requirements.components.map((component) => ({
        object_id: sourceObjectId,
        codename: component.componentCodename,
        data_type: component.valueType.toUpperCase(),
        is_required: component.required,
        target_object_id: slot.relation && component.valueType === 'ref' ? relationTarget?.id ?? null : null,
        target_object_kind: slot.relation && component.valueType === 'ref' ? relationTarget?.kind ?? null : null,
        target_object_codename: slot.relation && component.valueType === 'ref' ? relationTarget?.codename ?? null : null,
        validation_rules: {
            localized: component.localized,
            ...(component.semanticKey ? { unique: true } : {}),
            ...(component.maxLength ? { maxLength: component.maxLength } : {}),
            ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
            ...(component.format ? { format: component.format } : {})
        }
    }))

const projectionFor = (slot) =>
    slot.requirements.components
        .map(({ field, componentCodename }) => ({ field, componentCodename }))
        .sort((left, right) => left.field.localeCompare(right.field))

const validBindings = (definition, omittedSlot) => {
    const slots = (definition.bindingSlots ?? [])
        .filter((slot) => slot.key !== omittedSlot)
        .map((slot) => {
            const key = slot.requirements.components.find((component) => component.semanticKey)
            const selector = slot.selectorKinds.includes('semantic-key')
                ? { kind: 'semantic-key', field: key?.field ?? 'key', value: `${slot.key}-source` }
                : slot.selectorKinds.includes('relation-set')
                ? { kind: 'relation-set', parentSlot: slot.relation?.parentSlot ?? 'parent' }
                : { kind: 'record-set' }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: `Seed${slot.key[0].toUpperCase()}${slot.key.slice(1)}`,
                        selector,
                        projection: projectionFor(slot)
                    }
                ]
            }
        })
    return validateWidgetBindings(definition, { version: 1, slots })
}

const widgetRow = (widgetKey, rendererConfig, bindings, version = 5, zone = 'marketing-main') => ({
    id: widgetId,
    layout_id: layoutId,
    template_key: 'marketing-page',
    scope_entity_id: null,
    base_layout_id: null,
    widget_key: widgetKey,
    zone,
    config: encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone, rendererConfig }
    ),
    widget_version: version
})

const sourceRecordData = (slot, semanticKey = `${slot.key}-selected`) => {
    const data = {}
    for (const component of slot.requirements.components) {
        if (component.semanticKey) data[component.componentCodename] = semanticKey
        else if (component.localized) data[component.componentCodename] = localized(`${slot.key} content`)
        else if (component.valueType === 'string') data[component.componentCodename] = `${slot.key} value`
        else if (component.valueType === 'number') data[component.componentCodename] = 1
        else if (component.valueType === 'boolean') data[component.componentCodename] = true
        else if (component.valueType === 'ref') data[component.componentCodename] = recordId
        else data[component.componentCodename] = { value: `${slot.key} content` }
    }
    return data
}

const createHarness = (options) => {
    const rendererConfig = options.rendererConfig ?? {}
    const definition = getLayoutWidgetDefinition(options.widgetKey, rendererConfig)
    if (!definition) throw new Error(`Missing widget definition: ${options.widgetKey}`)
    const zone = definition.allowedZonesByTemplate['marketing-page']?.[0] ?? 'marketing-main'
    const row = widgetRow(options.widgetKey, rendererConfig, validBindings(definition, options.omitSlot), 5, zone)
    let sourceObject
    let sourceSlot
    let selectedRecord
    const persistedConfigs = []
    const transactionState = options.transactionState ?? { layoutConfigVersion: 5 }

    const store = {
        loadWidget: jest.fn(async () => row),
        listCandidates: jest.fn(async () => (sourceObject ? [sourceObject] : [])),
        countRecords: jest.fn(async (_db, _schema, ids) => ids.map((id) => ({ object_id: id, records_count: 3 }))),
        listRelationCompatibleObjectIds: jest.fn(async (_db, _schema, childIds) => [...childIds]),
        findObjectByCodename: jest.fn(async (_db, _schema, _requirements, sourceKey) =>
            sourceObject?.codename === sourceKey ? sourceObject : null
        ),
        loadObject: jest.fn(async () => {
            if (!sourceObject) throw new Error('No source object fixture')
            return sourceObject
        }),
        listComponents: jest.fn(async () => (sourceObject && sourceSlot ? componentRows(sourceObject.id, sourceSlot) : [])),
        findRecord: jest.fn(async () => (selectedRecord ? [selectedRecord] : [])),
        listRecords: jest.fn(async () => (selectedRecord ? [selectedRecord] : [])),
        hasUsage: jest.fn(async () => true),
        updateConfig: jest.fn(async (_db, _schema, input) => {
            decodeWidgetConfigEnvelope(input.config, {
                templateKey: 'marketing-page',
                widgetKey: options.widgetKey,
                zone: row.zone
            })
            persistedConfigs.push(input.config)
            row.config = input.config
            row.widget_version = 6
            return 6
        })
    }

    const query = jest.fn(async (sql) => {
        if (sql.includes('pg_advisory_xact_lock')) return []
        if (sql.includes('FOR UPDATE') && sql.includes('"_mhb_objects"')) {
            return [
                {
                    id: sourceObject?.id ?? objectId,
                    kind: sourceObject?.kind ?? 'object',
                    codename: sourceObject?.codename ?? 'UnknownSource',
                    config: sourceObject?.config ?? {}
                }
            ]
        }
        return []
    })
    const savepointExecutor = {
        query,
        transaction: jest.fn(async (callback) => {
            const snapshot = {
                config: row.config,
                widgetVersion: row.widget_version,
                transactionState: { ...transactionState }
            }
            try {
                return await callback(savepointExecutor)
            } catch (error) {
                row.config = snapshot.config
                row.widget_version = snapshot.widgetVersion
                Object.assign(transactionState, snapshot.transactionState)
                throw error
            }
        }),
        isReleased: () => false
    }
    const executor = {
        query,
        transaction: jest.fn(async (callback) => callback(savepointExecutor)),
        isReleased: () => false
    }
    const schemaService = { ensureSchema: jest.fn(async () => schemaName) }
    const service = new WidgetBindingService({ schemaService, store, syncLayoutConfig: options.syncLayoutConfig })

    const chooseSource = (slotKey, codename, policyOverrides) => {
        sourceSlot = definition.bindingSlots?.find(({ key }) => key === slotKey)
        if (!sourceSlot) throw new Error(`Missing slot: ${slotKey}`)
        sourceObject = {
            id: objectId,
            kind: 'object',
            codename,
            presentation: { name: localized(`${slotKey} source`) },
            config: { recordPolicy: { ...requirementsPolicy(sourceSlot), ...policyOverrides } },
            capabilities: Object.fromEntries(sourceSlot.requirements.entityCapabilities.map((key) => [key, { enabled: true }]))
        }
        selectedRecord = {
            id: recordId,
            data: sourceRecordData(sourceSlot),
            version: 3
        }
    }

    return {
        service,
        store,
        executor,
        savepointExecutor,
        query,
        schemaService,
        definition,
        row,
        persistedConfigs,
        transactionState,
        chooseSource
    }
}

const configureSourceFixtures = (harness, sourceDefinitions, definition = harness.definition) => {
    const sourcesByCodename = new Map()
    const sourcesById = new Map()
    const slotsByObjectId = new Map()
    const slotsByKey = new Map()
    for (const { slotKey, sourceKey, id } of sourceDefinitions) {
        const slot = definition.bindingSlots?.find(({ key }) => key === slotKey)
        if (!slot) throw new Error(`Missing slot: ${slotKey}`)
        const source = {
            id,
            kind: 'object',
            codename: sourceKey,
            presentation: { name: localized(`${slotKey} source`) },
            config: slot.requirements.recordPolicy ? { recordPolicy: requirementsPolicy(slot) } : {},
            capabilities: Object.fromEntries(slot.requirements.entityCapabilities.map((key) => [key, { enabled: true }]))
        }
        sourcesByCodename.set(sourceKey, source)
        sourcesById.set(id, source)
        slotsByObjectId.set(id, slot)
        slotsByKey.set(slotKey, slot)
    }
    harness.store.findObjectByCodename = jest.fn(async (_db, _schema, _requirements, sourceKey) => sourcesByCodename.get(sourceKey) ?? null)
    harness.store.loadObject = jest.fn(async (_db, _schema, id) => sourcesById.get(id))
    harness.store.listComponents = jest.fn(async (_db, _schema, ids) =>
        ids.flatMap((id) => {
            const slot = slotsByObjectId.get(id)
            if (!slot) return []
            const parentSlot = slot.relation?.parentSlot
            const parentDefinition = sourceDefinitions.find(({ slotKey }) => slotKey === parentSlot)
            const relationTarget = parentDefinition ? sourcesByCodename.get(parentDefinition.sourceKey) : undefined
            return componentRows(id, slot, relationTarget)
        })
    )
    harness.store.findRecord = jest.fn(async (_db, _schema, id, keyCodename, semanticKey) => {
        const slot = slotsByObjectId.get(id)
        const keyComponent = slot?.requirements.components.find(({ semanticKey: isKey }) => isKey)
        if (!slot || !keyComponent || keyCodename !== keyComponent.componentCodename) return []
        return [{ id: recordId, data: sourceRecordData(slot, semanticKey), version: 2 }]
    })
    harness.store.listRelationCompatibleObjectIds = jest.fn(async (_db, _schema, childIds, parentId) =>
        parentId === sourcesByCodename.get('PricingTiers')?.id ? [...childIds] : []
    )
    harness.query.mockImplementation(async (sql, params) => {
        if (sql.includes('pg_advisory_xact_lock')) return []
        if (sql.includes('FOR UPDATE') && sql.includes('"_mhb_objects"')) {
            const source = sourcesByCodename.get(params?.[1])
            return source ? [source] : []
        }
        return []
    })
    return { sourcesByCodename, slotsByKey }
}

const overrideRelationTarget = (harness, childObjectId, target) => {
    const listComponents = harness.store.listComponents
    harness.store.listComponents = jest.fn(async (...args) =>
        (await listComponents(...args)).map((component) =>
            component.object_id === childObjectId && component.data_type.toUpperCase() === 'REF'
                ? {
                      ...component,
                      target_object_id: target.id,
                      target_object_kind: target.kind,
                      target_object_codename: target.codename
                  }
                : component
        )
    )
}

module.exports = {
    schemaName,
    metahubId,
    widgetId,
    layoutId,
    objectId,
    recordId,
    sectionObjectId,
    localized,
    requirementsPolicy,
    componentRows,
    projectionFor,
    validBindings,
    widgetRow,
    sourceRecordData,
    createHarness,
    configureSourceFixtures,
    overrideRelationTarget
}
