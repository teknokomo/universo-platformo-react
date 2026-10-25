import { z } from 'zod'
import {
    applicationLearningContentSettingsSchema,
    applicationRolePolicySettingsSchema,
    sanitizeApplicationLearningContentSettings,
    sanitizeApplicationRolePolicySettingsForSupportedScopes
} from './lmsPlatform'
import { layoutInstanceKeySchema } from './applicationLayouts'
import { isRegisteredWorkspaceWidgetSettingKey } from './workspaceWidgetSettingRegistry'

export const SETTINGS_LAYER_ORDER = ['metahub', 'application', 'workspace'] as const
export type SettingsLayer = (typeof SETTINGS_LAYER_ORDER)[number]

export const SETTINGS_TARGET_KINDS = ['global', 'layout', 'widget', 'entity'] as const
export type SettingsTargetKind = (typeof SETTINGS_TARGET_KINDS)[number]

export const SETTINGS_CONTROL_TYPES = ['boolean', 'select', 'number', 'string', 'structured'] as const
export type SettingsControlType = (typeof SETTINGS_CONTROL_TYPES)[number]

export const WORKSPACE_SETTING_MUTABILITY = ['application-only', 'workspace-allowed', 'workspace-locked'] as const
export type WorkspaceSettingMutability = (typeof WORKSPACE_SETTING_MUTABILITY)[number]

export const SETTING_SOURCES = ['default', 'metahub', 'application', 'workspace'] as const
export type SettingSource = (typeof SETTING_SOURCES)[number]

export interface UnifiedSettingDefinition<TValue = unknown> {
    key: string
    labelKey: string
    descriptionKey: string
    tab: string
    scope: SettingsLayer[]
    targetKind: SettingsTargetKind
    controlType: SettingsControlType
    defaultValue: TValue
    options?: readonly string[]
    workspaceMutability: WorkspaceSettingMutability
    sortOrder: number
    parse: (value: unknown) => TValue
}

export interface EffectiveSetting<TValue = unknown> {
    key: string
    value: TValue
    source: SettingSource
    isInherited: boolean
    definition: UnifiedSettingDefinition<TValue>
}

const booleanSetting =
    (defaultValue: boolean) =>
    (value: unknown): boolean =>
        typeof value === 'boolean' ? value : defaultValue

const selectSetting =
    <TOption extends string>(options: readonly TOption[], defaultValue: TOption) =>
    (value: unknown): TOption =>
        typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as TOption) : defaultValue

export const applicationDashboardDefaultModeSchema = z.enum(['layout-default', 'first-menu-item']).default('layout-default')
export const applicationDatasourceExecutionPolicySchema = z.enum(['workspace-scoped', 'layout-only']).default('workspace-scoped')
export const applicationWorkspaceOpenBehaviorSchema = z.enum(['last-used', 'default-workspace']).default('last-used')
export const dialogSizePresetSchema = z.enum(['small', 'medium', 'large']).default('medium')
export const dialogCloseBehaviorSchema = z.enum(['strict-modal', 'backdrop-close']).default('strict-modal')

export const workspaceSettingTargetSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('global') }).strict(),
    z.object({ kind: z.literal('widget'), instanceKey: layoutInstanceKeySchema }).strict()
])
export type WorkspaceSettingTarget = z.infer<typeof workspaceSettingTargetSchema>

export const workspaceSettingAddressSchema = z
    .object({
        key: z.string().min(1).max(160),
        target: workspaceSettingTargetSchema
    })
    .strict()
export type WorkspaceSettingAddress = z.infer<typeof workspaceSettingAddressSchema>

export const applicationWorkspaceOverridePolicySchema = z
    .object({
        allowedAddresses: z.array(workspaceSettingAddressSchema).default([]),
        lockedAddresses: z.array(workspaceSettingAddressSchema).default([])
    })
    .strict()
    .default({})
export type ApplicationWorkspaceOverridePolicy = z.infer<typeof applicationWorkspaceOverridePolicySchema>

export const unifiedApplicationSettingsSchema = z
    .object({
        dialogSizePreset: dialogSizePresetSchema.optional(),
        dialogAllowFullscreen: z.boolean().optional(),
        dialogAllowResize: z.boolean().optional(),
        dialogCloseBehavior: dialogCloseBehaviorSchema.optional(),
        sectionLinksEnabled: z.boolean().optional(),
        dashboardDefaultMode: applicationDashboardDefaultModeSchema.optional(),
        datasourceExecutionPolicy: applicationDatasourceExecutionPolicySchema.optional(),
        workspaceOpenBehavior: applicationWorkspaceOpenBehaviorSchema.optional(),
        schemaDiffLocalizedLabels: z.boolean().optional(),
        learningContent: applicationLearningContentSettingsSchema.optional(),
        rolePolicies: applicationRolePolicySettingsSchema.optional(),
        workspaceOverrides: applicationWorkspaceOverridePolicySchema.optional()
    })
    .strict()
export type UnifiedApplicationSettings = z.infer<typeof unifiedApplicationSettingsSchema>

export const workspaceSettingOverrideSchema = z
    .object({
        key: z.string().min(1).max(160),
        target: workspaceSettingTargetSchema.default({ kind: 'global' }),
        value: z.unknown(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()
export type WorkspaceSettingOverrideInput = z.infer<typeof workspaceSettingOverrideSchema>

export const workspaceSettingResetSchema = z
    .object({
        key: z.string().min(1).max(160),
        target: workspaceSettingTargetSchema.default({ kind: 'global' }),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()
export type WorkspaceSettingResetInput = z.infer<typeof workspaceSettingResetSchema>

export const workspaceSettingBatchUpdateSchema = z
    .object({
        settings: z.array(workspaceSettingOverrideSchema).max(50).default([]),
        resetKeys: z.array(z.string().min(1).max(160)).max(50).default([]),
        resets: z.array(workspaceSettingResetSchema).max(50).default([])
    })
    .strict()
    .superRefine((value, ctx) => {
        const seen = new Set<string>()
        const operations = [
            ...value.settings.map((setting, index) => ({ setting, path: ['settings', index] as (string | number)[] })),
            ...value.resets.map((reset, index) => ({ setting: reset, path: ['resets', index] as (string | number)[] })),
            ...value.resetKeys.map((key, index) => ({
                setting: { key, target: { kind: 'global' as const } },
                path: ['resetKeys', index] as (string | number)[]
            }))
        ]

        for (const operation of operations) {
            const identity = JSON.stringify([
                operation.setting.key,
                operation.setting.target.kind,
                operation.setting.target.kind === 'widget' ? operation.setting.target.instanceKey : ''
            ])
            if (seen.has(identity)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: operation.path,
                    message: 'A setting address can be changed or reset only once per request'
                })
            }
            seen.add(identity)
        }
    })
export type WorkspaceSettingBatchUpdate = z.infer<typeof workspaceSettingBatchUpdateSchema>

export const WORKSPACE_OVERRIDABLE_SETTING_KEYS = [
    'sectionLinksEnabled',
    'dashboardDefaultMode',
    'workspaceOpenBehavior',
    'learningContent.defaultView',
    'learningContent.playerPreset.showOutline',
    'learningContent.playerPreset.showProgressHeader',
    'learningContent.playerPreset.completeButtonMode'
] as const

export type WorkspaceOverridableSettingKey = (typeof WORKSPACE_OVERRIDABLE_SETTING_KEYS)[number]

const DEFAULT_WORKSPACE_OVERRIDE_ALLOWED_KEYS: WorkspaceOverridableSettingKey[] = [
    'sectionLinksEnabled',
    'dashboardDefaultMode',
    'workspaceOpenBehavior',
    'learningContent.defaultView'
]

export const getDefaultWorkspaceOverrideAllowedKeys = (): WorkspaceOverridableSettingKey[] => [...DEFAULT_WORKSPACE_OVERRIDE_ALLOWED_KEYS]

export const getDefaultWorkspaceOverrideAllowedAddresses = (): WorkspaceSettingAddress[] =>
    getDefaultWorkspaceOverrideAllowedKeys().map((key) => ({ key, target: { kind: 'global' } }))

export const UNIFIED_SETTINGS_REGISTRY: readonly UnifiedSettingDefinition[] = [
    {
        key: 'dialogSizePreset',
        labelKey: 'settings.keys.dialogSizePreset',
        descriptionKey: 'settings.keys.dialogSizePreset.description',
        tab: 'general',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'medium',
        options: ['small', 'medium', 'large'],
        workspaceMutability: 'application-only',
        sortOrder: 10,
        parse: selectSetting(['small', 'medium', 'large'] as const, 'medium')
    },
    {
        key: 'dialogAllowFullscreen',
        labelKey: 'settings.keys.dialogAllowFullscreen',
        descriptionKey: 'settings.keys.dialogAllowFullscreen.description',
        tab: 'general',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'application-only',
        sortOrder: 20,
        parse: booleanSetting(true)
    },
    {
        key: 'dialogAllowResize',
        labelKey: 'settings.keys.dialogAllowResize',
        descriptionKey: 'settings.keys.dialogAllowResize.description',
        tab: 'general',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'application-only',
        sortOrder: 30,
        parse: booleanSetting(true)
    },
    {
        key: 'dialogCloseBehavior',
        labelKey: 'settings.keys.dialogCloseBehavior',
        descriptionKey: 'settings.keys.dialogCloseBehavior.description',
        tab: 'general',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'strict-modal',
        options: ['strict-modal', 'backdrop-close'],
        workspaceMutability: 'application-only',
        sortOrder: 40,
        parse: selectSetting(['strict-modal', 'backdrop-close'] as const, 'strict-modal')
    },
    {
        key: 'sectionLinksEnabled',
        labelKey: 'settings.keys.sectionLinksEnabled',
        descriptionKey: 'settings.keys.sectionLinksEnabled.description',
        tab: 'navigation',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'workspace-allowed',
        sortOrder: 50,
        parse: booleanSetting(true)
    },
    {
        key: 'dashboardDefaultMode',
        labelKey: 'settings.keys.dashboardDefaultMode',
        descriptionKey: 'settings.keys.dashboardDefaultMode.description',
        tab: 'navigation',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'layout-default',
        options: ['layout-default', 'first-menu-item'],
        workspaceMutability: 'workspace-allowed',
        sortOrder: 60,
        parse: selectSetting(['layout-default', 'first-menu-item'] as const, 'layout-default')
    },
    {
        key: 'datasourceExecutionPolicy',
        labelKey: 'settings.keys.datasourceExecutionPolicy',
        descriptionKey: 'settings.keys.datasourceExecutionPolicy.description',
        tab: 'runtime',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'workspace-scoped',
        options: ['workspace-scoped', 'layout-only'],
        workspaceMutability: 'application-only',
        sortOrder: 70,
        parse: selectSetting(['workspace-scoped', 'layout-only'] as const, 'workspace-scoped')
    },
    {
        key: 'workspaceOpenBehavior',
        labelKey: 'settings.keys.workspaceOpenBehavior',
        descriptionKey: 'settings.keys.workspaceOpenBehavior.description',
        tab: 'workspace',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'last-used',
        options: ['last-used', 'default-workspace'],
        workspaceMutability: 'workspace-allowed',
        sortOrder: 80,
        parse: selectSetting(['last-used', 'default-workspace'] as const, 'last-used')
    },
    {
        key: 'schemaDiffLocalizedLabels',
        labelKey: 'settings.keys.schemaDiffLocalizedLabels',
        descriptionKey: 'settings.keys.schemaDiffLocalizedLabels.description',
        tab: 'runtime',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'application-only',
        sortOrder: 90,
        parse: booleanSetting(true)
    },
    {
        key: 'learningContent.defaultView',
        labelKey: 'settings.keys.learningContent.defaultView',
        descriptionKey: 'settings.keys.learningContent.defaultView.description',
        tab: 'learningContent',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'table',
        options: ['table', 'cards'],
        workspaceMutability: 'workspace-allowed',
        sortOrder: 100,
        parse: selectSetting(['table', 'cards'] as const, 'table')
    },
    {
        key: 'learningContent.playerPreset.showOutline',
        labelKey: 'settings.keys.learningContent.playerPreset.showOutline',
        descriptionKey: 'settings.keys.learningContent.playerPreset.showOutline.description',
        tab: 'learningContent',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'workspace-allowed',
        sortOrder: 110,
        parse: booleanSetting(true)
    },
    {
        key: 'learningContent.playerPreset.showProgressHeader',
        labelKey: 'settings.keys.learningContent.playerPreset.showProgressHeader',
        descriptionKey: 'settings.keys.learningContent.playerPreset.showProgressHeader.description',
        tab: 'learningContent',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'boolean',
        defaultValue: true,
        workspaceMutability: 'workspace-allowed',
        sortOrder: 120,
        parse: booleanSetting(true)
    },
    {
        key: 'learningContent.playerPreset.completeButtonMode',
        labelKey: 'settings.keys.learningContent.playerPreset.completeButtonMode',
        descriptionKey: 'settings.keys.learningContent.playerPreset.completeButtonMode.description',
        tab: 'learningContent',
        scope: ['application', 'workspace'],
        targetKind: 'global',
        controlType: 'select',
        defaultValue: 'manual',
        options: ['manual', 'autoAfterOpen', 'hidden'],
        workspaceMutability: 'workspace-allowed',
        sortOrder: 130,
        parse: selectSetting(['manual', 'autoAfterOpen', 'hidden'] as const, 'manual')
    },
    {
        key: 'learningContent',
        labelKey: 'settings.keys.learningContent',
        descriptionKey: 'settings.keys.learningContent.description',
        tab: 'learningContent',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'structured',
        defaultValue: sanitizeApplicationLearningContentSettings(undefined),
        workspaceMutability: 'application-only',
        sortOrder: 1000,
        parse: sanitizeApplicationLearningContentSettings
    },
    {
        key: 'rolePolicies',
        labelKey: 'settings.keys.rolePolicies',
        descriptionKey: 'settings.keys.rolePolicies.description',
        tab: 'access',
        scope: ['application'],
        targetKind: 'global',
        controlType: 'structured',
        defaultValue: undefined,
        workspaceMutability: 'application-only',
        sortOrder: 1010,
        parse: sanitizeApplicationRolePolicySettingsForSupportedScopes
    }
] as const

const REGISTRY_BY_KEY = new Map(UNIFIED_SETTINGS_REGISTRY.map((definition) => [definition.key, definition]))

export const getUnifiedSettingDefinition = (key: string): UnifiedSettingDefinition | undefined => REGISTRY_BY_KEY.get(key)

export const listUnifiedSettingsForLayer = (layer: SettingsLayer): UnifiedSettingDefinition[] =>
    UNIFIED_SETTINGS_REGISTRY.filter((definition) => definition.scope.includes(layer)).sort((a, b) => a.sortOrder - b.sortOrder)

export const listWorkspaceOverridableSettings = (): UnifiedSettingDefinition[] =>
    UNIFIED_SETTINGS_REGISTRY.filter((definition) => definition.workspaceMutability === 'workspace-allowed').sort(
        (a, b) => a.sortOrder - b.sortOrder
    )

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const getNestedSettingValue = (settings: Record<string, unknown> | null | undefined, key: string): unknown => {
    if (!settings) return undefined
    const parts = key.split('.')
    let current: unknown = settings
    for (const part of parts) {
        if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
            return undefined
        }
        current = current[part]
    }
    return current
}

export const setNestedSettingValue = (
    settings: Record<string, unknown> | null | undefined,
    key: string,
    value: unknown
): Record<string, unknown> => {
    const next: Record<string, unknown> = { ...(isRecord(settings) ? settings : {}) }
    const parts = key.split('.')
    let cursor = next
    parts.slice(0, -1).forEach((part) => {
        const existing = cursor[part]
        const child = isRecord(existing) ? { ...existing } : {}
        cursor[part] = child
        cursor = child
    })
    cursor[parts[parts.length - 1]] = value
    return next
}

export const normalizeApplicationWorkspaceOverridePolicy = (
    settings: Record<string, unknown> | null | undefined
): ApplicationWorkspaceOverridePolicy => {
    const rawPolicy = isRecord(settings) ? settings.workspaceOverrides : undefined
    const parsed = applicationWorkspaceOverridePolicySchema.safeParse(rawPolicy)
    const policy = parsed.success ? parsed.data : { allowedAddresses: [], lockedAddresses: [] }
    const knownWorkspaceKeys = new Set(listWorkspaceOverridableSettings().map((definition) => definition.key))
    const hasExplicitAllowedAddresses = isRecord(rawPolicy) && Object.prototype.hasOwnProperty.call(rawPolicy, 'allowedAddresses')
    const allowedAddresses = parsed.success
        ? hasExplicitAllowedAddresses
            ? policy.allowedAddresses
            : getDefaultWorkspaceOverrideAllowedAddresses()
        : []
    const normalizeAddresses = (addresses: WorkspaceSettingAddress[]): WorkspaceSettingAddress[] => {
        const seen = new Set<string>()
        return addresses.filter((address) => {
            if (address.target.kind === 'global' && !knownWorkspaceKeys.has(address.key)) return false
            if (address.target.kind === 'widget' && !isRegisteredWorkspaceWidgetSettingKey(address.key)) return false
            const identity = JSON.stringify([
                address.key,
                address.target.kind,
                address.target.kind === 'widget' ? address.target.instanceKey : ''
            ])
            if (seen.has(identity)) return false
            seen.add(identity)
            return true
        })
    }
    const lockedAddresses = normalizeAddresses(policy.lockedAddresses)
    const lockedIdentities = new Set(
        lockedAddresses.map((address) =>
            JSON.stringify([address.key, address.target.kind, address.target.kind === 'widget' ? address.target.instanceKey : ''])
        )
    )
    return {
        allowedAddresses: normalizeAddresses(allowedAddresses).filter(
            (address) =>
                !lockedIdentities.has(
                    JSON.stringify([address.key, address.target.kind, address.target.kind === 'widget' ? address.target.instanceKey : ''])
                )
        ),
        lockedAddresses
    }
}

export const isWorkspaceSettingAddressAllowed = (
    settings: Record<string, unknown> | null | undefined,
    inputAddress: WorkspaceSettingAddress
): boolean => {
    const parsedAddress = workspaceSettingAddressSchema.safeParse(inputAddress)
    if (!parsedAddress.success) return false
    if (parsedAddress.data.target.kind === 'global') {
        const definition = getUnifiedSettingDefinition(parsedAddress.data.key)
        if (!definition || definition.workspaceMutability !== 'workspace-allowed') return false
    } else if (!isRegisteredWorkspaceWidgetSettingKey(parsedAddress.data.key)) {
        return false
    }
    const policy = normalizeApplicationWorkspaceOverridePolicy(settings)
    const identity = JSON.stringify([
        parsedAddress.data.key,
        parsedAddress.data.target.kind,
        parsedAddress.data.target.kind === 'widget' ? parsedAddress.data.target.instanceKey : ''
    ])
    return policy.allowedAddresses.some((address) => {
        const addressIdentity = JSON.stringify([
            address.key,
            address.target.kind,
            address.target.kind === 'widget' ? address.target.instanceKey : ''
        ])
        return addressIdentity === identity
    })
}

export const isWorkspaceSettingAllowed = (settings: Record<string, unknown> | null | undefined, key: string): boolean =>
    isWorkspaceSettingAddressAllowed(settings, { key, target: { kind: 'global' } })

export const parseUnifiedSettingValue = (key: string, value: unknown): unknown => {
    const definition = getUnifiedSettingDefinition(key)
    if (!definition) {
        throw new Error(`Unknown setting key: ${key}`)
    }
    return definition.parse(value)
}

export const applyWorkspaceSettingOverrides = (
    applicationSettings: Record<string, unknown> | null | undefined,
    overrides: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
    let next: Record<string, unknown> = { ...(isRecord(applicationSettings) ? applicationSettings : {}) }
    if (!isRecord(overrides)) {
        return next
    }

    for (const [key, value] of Object.entries(overrides)) {
        if (!isWorkspaceSettingAllowed(applicationSettings, key)) {
            continue
        }
        next = setNestedSettingValue(next, key, parseUnifiedSettingValue(key, value))
    }

    return next
}

export const resolveEffectiveSetting = (
    definition: UnifiedSettingDefinition,
    applicationSettings: Record<string, unknown> | null | undefined,
    workspaceOverrides?: Record<string, unknown> | null
): EffectiveSetting => {
    const workspaceValue =
        getNestedSettingValue(workspaceOverrides ?? {}, definition.key) ??
        (isRecord(workspaceOverrides) && Object.prototype.hasOwnProperty.call(workspaceOverrides, definition.key)
            ? workspaceOverrides[definition.key]
            : undefined)
    if (workspaceValue !== undefined && isWorkspaceSettingAllowed(applicationSettings, definition.key)) {
        return {
            key: definition.key,
            value: definition.parse(workspaceValue),
            source: 'workspace',
            isInherited: false,
            definition
        }
    }

    const applicationValue = getNestedSettingValue(applicationSettings ?? {}, definition.key)
    if (applicationValue !== undefined) {
        return {
            key: definition.key,
            value: definition.parse(applicationValue),
            source: 'application',
            isInherited: true,
            definition
        }
    }

    return {
        key: definition.key,
        value: definition.defaultValue,
        source: 'default',
        isInherited: true,
        definition
    }
}
