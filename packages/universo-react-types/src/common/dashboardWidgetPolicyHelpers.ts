import type { LayoutWidgetAuthoringCapabilities, LayoutWidgetPresentationField, WidgetBindingSlotDefinition } from './widgetBindings'
import type { DashboardLayoutWidgetDefinition, DashboardLayoutZone, DashboardWidgetSeedPolicy } from './dashboardWidgetOwnership'

export const DASHBOARD_SEMANTIC_KEY_PATTERN = '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'

type BindingComponentRequirement = WidgetBindingSlotDefinition['requirements']['components'][number]

export const component = (
    field: string,
    componentCodename: string,
    valueType: 'string' | 'number' | 'boolean' | 'json' | 'ref',
    localized = false,
    required = true,
    options: Partial<Pick<BindingComponentRequirement, 'allowServerOwnedRead' | 'semanticKey' | 'maxLength' | 'pattern' | 'format'>> = {}
): BindingComponentRequirement => ({ field, componentCodename, valueType, localized, required, ...options })

export const makeBindingSlot = (
    key: string,
    selectorKind: 'semantic-key' | 'record-set' | 'learner-enrollment-set' | 'relation-set',
    components: ReturnType<typeof component>[],
    options: {
        required?: boolean
        maxTargets?: number
        maxResolvedRecords?: number
        entityKinds?: ('object' | 'page')[]
        entityCodenames?: string[]
        relation?: { field: string; parentSlot: string }
        orderByField?: string
        projectionMode?: WidgetBindingSlotDefinition['projectionMode']
    } = {}
): WidgetBindingSlotDefinition => ({
    key,
    ...(options.projectionMode ? { projectionMode: options.projectionMode } : {}),
    selectorKinds: [selectorKind],
    authoring: {
        labelKey: 'layouts.widgetBindings.' + key + '.label',
        defaultLabel: key === 'content' ? 'Content record' : 'Content source',
        placeholderKey: 'layouts.widgetBindings.' + key + '.placeholder',
        defaultPlaceholder: 'Choose a content source',
        helperTextKey: 'layouts.widgetBindings.' + key + '.helperText',
        defaultHelperText: 'Choose the Entity source used by this widget.',
        emptyOptionsKey: 'layouts.widgetBindings.' + key + '.noOptions',
        defaultEmptyOptions: 'No compatible content sources found.',
        loadingOptionsKey: 'layouts.widgetBindings.' + key + '.loading',
        defaultLoadingOptions: 'Loading compatible content sources…'
    },
    cardinality: { min: options.required === false ? 0 : 1, max: options.maxTargets ?? 1 },
    ...(selectorKind !== 'semantic-key' ? { maxResolvedRecords: options.maxResolvedRecords ?? 100 } : {}),
    ...(options.relation ? { relation: options.relation } : {}),
    ...(options.orderByField ? { orderByField: options.orderByField } : {}),
    requirements: {
        entityCapabilities: ['dataSchema', 'records'],
        entityKinds: options.entityKinds ?? ['object'],
        ...(options.entityCodenames ? { entityCodenames: options.entityCodenames } : {}),
        components
    }
})

export const contentSlot = () =>
    makeBindingSlot(
        'content',
        'semantic-key',
        [
            component('key', 'Key', 'string', false, true, {
                semanticKey: true,
                maxLength: 128,
                pattern: DASHBOARD_SEMANTIC_KEY_PATTERN
            }),
            component('title', 'Title', 'string', true, true, { maxLength: 255 }),
            component('body', 'Body', 'string', true, false, { maxLength: 4096 })
        ],
        {
            entityKinds: ['object', 'page']
        }
    )
export const metricSetSlot = () =>
    makeBindingSlot(
        'metrics',
        'record-set',
        [
            component('metricKey', 'MetricKey', 'string', false, true, {
                semanticKey: true,
                maxLength: 128,
                pattern: DASHBOARD_SEMANTIC_KEY_PATTERN
            }),
            component('title', 'Title', 'string', true, true, { maxLength: 255 }),
            component('interval', 'Interval', 'string', true, false, { maxLength: 128 }),
            component('value', 'Value', 'number'),
            component('order', 'Order', 'number')
        ],
        { maxResolvedRecords: 12, orderByField: 'order' }
    )
export const seriesSlot = () =>
    makeBindingSlot(
        'series',
        'record-set',
        [
            component('seriesKey', 'SeriesKey', 'string'),
            component('seriesLabel', 'SeriesLabel', 'string', true, true, { maxLength: 160 }),
            component('timestamp', 'Timestamp', 'string'),
            component('value', 'Value', 'number'),
            component('order', 'Order', 'number')
        ],
        { maxResolvedRecords: 366, orderByField: 'order' }
    )
export const rowsSlot = () =>
    makeBindingSlot('rows', 'record-set', [], {
        maxResolvedRecords: 500,
        projectionMode: 'entity-schema'
    })
export const libraryRowsSlot = () =>
    makeBindingSlot('rows', 'record-set', [component('title', 'Title', 'string', true)], {
        maxTargets: 16,
        maxResolvedRecords: 500,
        orderByField: 'title'
    })
export const learnerEnrollmentRowsSlot = () =>
    makeBindingSlot(
        'rows',
        'learner-enrollment-set',
        [
            component('title', 'TargetTitle', 'string', true, true, { maxLength: 500 }),
            component('assignedUser', 'AssignedUserId', 'string', false, false),
            component('targetKind', 'TargetType', 'string')
        ],
        { maxResolvedRecords: 100, orderByField: 'title', entityCodenames: ['Enrollments'] }
    )
export const menuItemsSlot = () =>
    makeBindingSlot(
        'items',
        'record-set',
        [component('label', 'Label', 'string', true), component('href', 'Href', 'string'), component('order', 'Order', 'number')],
        { maxResolvedRecords: 100, orderByField: 'order' }
    )

export const componentField = (
    key: string,
    defaultLabel: string,
    options: readonly string[],
    defaultValue = options[0]
): LayoutWidgetPresentationField => ({
    key,
    kind: 'select',
    labelKey: 'layouts.widgetPresentation.' + key + '.label',
    defaultLabel,
    helperTextKey: 'layouts.widgetPresentation.' + key + '.help',
    defaultHelperText: 'Choose a supported presentation option.',
    defaultValue,
    required: false,
    options: options.map((value) => ({
        value,
        labelKey: 'layouts.widgetPresentation.' + key + '.' + value,
        defaultLabel: value.replace(/[-_]/gu, ' ')
    }))
})

export const numberField = (
    key: string,
    defaultLabel: string,
    defaultValue: number,
    min: number,
    max: number
): LayoutWidgetPresentationField => ({
    key,
    kind: 'number',
    labelKey: 'layouts.widgetPresentation.' + key + '.label',
    defaultLabel,
    helperTextKey: 'layouts.widgetPresentation.' + key + '.help',
    defaultHelperText: 'Choose a value within the supported range.',
    defaultValue,
    min,
    max
})

export const switchField = (key: string, defaultLabel: string, defaultValue: boolean): LayoutWidgetPresentationField => ({
    key,
    kind: 'switch',
    labelKey: 'layouts.widgetPresentation.' + key + '.label',
    defaultLabel,
    helperTextKey: 'layouts.widgetPresentation.' + key + '.help',
    defaultHelperText: 'Change this widget presentation option.',
    defaultValue
})

export const selectField = (
    key: string,
    defaultLabel: string,
    values: readonly string[],
    defaultValue = values[0]
): LayoutWidgetPresentationField => componentField(key, defaultLabel, values, defaultValue)

export const sourceNone = {
    authority: 'metahub-source',
    sourceMode: 'none',
    inheritBindings: false,
    inheritComposition: false
} as const
export const sourceOptional = {
    authority: 'metahub-source',
    sourceMode: 'optional',
    inheritBindings: true,
    inheritComposition: false
} as const
export const sourceRequired = {
    authority: 'metahub-source',
    sourceMode: 'required',
    inheritBindings: true,
    inheritComposition: false
} as const
export const sourceSpecialized = {
    authority: 'metahub-source',
    sourceMode: 'specialized',
    inheritBindings: false,
    inheritComposition: false
} as const
export const sourceContainer = {
    authority: 'metahub-source',
    sourceMode: 'none',
    inheritBindings: false,
    inheritComposition: true
} as const

export const sourceManagedAuthoring = (
    duplicate: LayoutWidgetAuthoringCapabilities['metahub']['duplicate'],
    contentEditing: LayoutWidgetAuthoringCapabilities['metahub']['contentEditing'],
    canRebind = false
): LayoutWidgetAuthoringCapabilities => ({
    metahub: { add: 'select-source', duplicate, contentEditing, canRebind },
    application: {
        presentationOnly: true,
        canAdd: false,
        canDuplicate: false,
        canEditContent: false,
        canRebind: false,
        resetToSource: true
    }
})

type DashboardWidgetPolicy = Omit<
    DashboardLayoutWidgetDefinition,
    | 'key'
    | 'templateKey'
    | 'supportedTemplates'
    | 'allowedZones'
    | 'allowedZonesByTemplate'
    | 'multiInstance'
    | 'shared'
    | 'labelKey'
    | 'defaultLabel'
>

export const toDefaultLabel = (key: string): string => {
    const spaced = key.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').replace(/[-_]+/gu, ' ')
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const registerWidget = <TKey extends string, const TZones extends readonly DashboardLayoutZone[]>(
    key: TKey,
    allowedZones: TZones,
    multiInstance: boolean,
    policy: DashboardWidgetPolicy
): DashboardLayoutWidgetDefinition & { readonly key: TKey; readonly allowedZones: TZones } => {
    const shared = key === 'languageSwitcher' || key === 'colorModeSwitcher'
    const supportedTemplates = shared ? (['dashboard', 'marketing-page'] as const) : (['dashboard'] as const)
    return {
        key,
        templateKey: 'dashboard',
        supportedTemplates,
        allowedZones,
        allowedZonesByTemplate: shared
            ? { dashboard: allowedZones, 'marketing-page': ['marketing-header'] as const }
            : { dashboard: allowedZones },
        multiInstance,
        shared,
        labelKey: 'layouts.widgets.' + key,
        defaultLabel: toDefaultLabel(key),
        ...(shared ? { defaultPlacement: 'end' as const, mobileProjection: 'compact-header' as const } : {}),
        ...policy
    }
}

export const hostPolicy = (
    seedPolicies: DashboardWidgetSeedPolicy[],
    options: Partial<DashboardWidgetPolicy> = {}
): DashboardWidgetPolicy =>
    ({
        sourceClass: 'host',
        sourcePolicy: sourceNone,
        identity: { instanceKey: 'required' },
        requiredHostCapabilities: [],
        presentationFields: [],
        configFields: [],
        authoring: sourceManagedAuthoring('none', 'none'),
        copyPolicy: { placement: 'copy', binding: 'none' },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false },
        placementPolicy: { parent: 'root-or-compatible-container-slot' },
        capabilities: ['dashboard.host'],
        seedPolicies,
        ...options
    } as DashboardWidgetPolicy)

export const structuralPolicy = (
    seedPolicies: DashboardWidgetSeedPolicy[],
    options: Partial<DashboardWidgetPolicy> = {}
): DashboardWidgetPolicy =>
    ({
        sourceClass: 'structural',
        sourcePolicy: sourceContainer,
        identity: { instanceKey: 'required' },
        requiredHostCapabilities: [],
        presentationFields: [],
        configFields: [],
        authoring: sourceManagedAuthoring('none', 'none'),
        copyPolicy: { placement: 'copy', binding: 'none' },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false },
        placementPolicy: { parent: 'root-only' },
        composition: { sourceOwned: true },
        capabilities: ['dashboard.structural'],
        seedPolicies,
        ...options
    } as DashboardWidgetPolicy)

export const boundPolicy = (
    sourceClass: 'entity' | 'bounded-data',
    sourcePolicy: typeof sourceOptional | typeof sourceRequired,
    duplicate: 'share-bindings' | 'clone-record',
    contentEditing: LayoutWidgetAuthoringCapabilities['metahub']['contentEditing'],
    slots: readonly WidgetBindingSlotDefinition[],
    seedPolicies: DashboardWidgetSeedPolicy[],
    options: Partial<DashboardWidgetPolicy> = {}
): DashboardWidgetPolicy =>
    ({
        sourceClass,
        sourcePolicy,
        identity: { instanceKey: 'required' },
        requiredHostCapabilities: [],
        bindingSlots: slots,
        presentationFields: [],
        configFields: [],
        authoring: sourceManagedAuthoring(duplicate, contentEditing, true),
        copyPolicy: { placement: 'copy', binding: duplicate },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false },
        placementPolicy: { parent: 'root-or-compatible-container-slot' },
        capabilities: ['dashboard.content'],
        seedPolicies,
        ...options
    } as DashboardWidgetPolicy)

export const specializedPolicy = (
    seedPolicies: DashboardWidgetSeedPolicy[],
    options: Partial<DashboardWidgetPolicy> = {}
): DashboardWidgetPolicy =>
    ({
        sourceClass: 'specialized-runtime',
        sourcePolicy: sourceSpecialized,
        identity: { instanceKey: 'required' },
        requiredHostCapabilities: [],
        presentationFields: [],
        configFields: [],
        authoring: sourceManagedAuthoring('none', 'none'),
        copyPolicy: { placement: 'copy', binding: 'none' },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false },
        placementPolicy: { parent: 'root-or-compatible-container-slot' },
        capabilities: ['dashboard.runtime'],
        seedPolicies,
        ...options
    } as DashboardWidgetPolicy)
