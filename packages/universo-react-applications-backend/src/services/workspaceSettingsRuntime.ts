import { createHash } from 'node:crypto'
import type { DbExecutor } from '@universo-react/utils'
import {
    interpretationNetworkCellStylePolicySchema,
    isInterpretationNetworkCellStyleWorkspaceSettingKey,
    layoutInstanceKeySchema,
    listWorkspaceOverridableSettings,
    resolveEffectiveSetting,
    runtimeTargetSchema,
    type InterpretationNetworkCellStylePolicy,
    type InterpretationNetworkCellStyleWorkspaceSettingKey,
    type RuntimeTarget,
    type UnifiedSettingDefinition,
    type WorkspaceSettingAddress
} from '@universo-react/types'
import { EffectiveLayoutError } from './effectiveLayoutContract'
import { resolveEffectiveLayoutStructureForRequest } from './effectiveLayoutResolverCore'
import { findDefaultWorkspaceSettingLayouts, resolveWorkspaceSettingAddressRows } from '../persistence/workspaceSettingsResolutionStore'
import type { WorkspaceSettingLayoutRow } from '../persistence/workspaceSettingsResolutionStore'
import { listWorkspaceSettingOverrides } from './workspaceSettingsApplicationService'
import {
    isWorkspaceSettingAddressAllowed,
    type WorkspaceSettingOverrideRow,
    type WorkspaceSettingsResolverAuthContext
} from '../shared/workspaceSettingsContracts'
import {
    addressLabel,
    CELL_STYLE_SETTING_PATHS,
    getCellStyleSettingPath,
    isRecord,
    parseWorkspaceSettingValue,
    WORKSPACE_SETTINGS_ERROR_CODES,
    WorkspaceSettingsError,
    workspaceSettingAddressSchema,
    type EffectiveWorkspaceWidgetConfig,
    type ResolvedWorkspaceSettingAddress,
    type RuntimeWorkspaceSettingsSnapshot,
    type RuntimeWorkspaceWidgetSetting
} from './workspaceSettingsCore'

type CurrentWorkspaceSettingLayout = WorkspaceSettingLayoutRow

type EffectiveWorkspaceLayout = {
    layout: { id: string; version: number | null; effectiveHash: string }
    widgets: Array<{
        id: string
        instanceKey: string
        widgetKey: string
        zone: EffectiveWorkspaceWidgetConfig['zone']
        semanticRegion: EffectiveWorkspaceWidgetConfig['semanticRegion']
        config: Record<string, unknown>
        isActive: boolean
    }>
}

const WORKSPACE_MATRIX_WIDGET_KEY = 'interpretationNetworkWorkspace'

const getPolicySettingPath = (key: string): readonly string[] | undefined => {
    const configPath = getCellStyleSettingPath(key)
    return configPath?.[0] === 'cellStylePolicy' && configPath.length > 1 ? configPath.slice(1) : undefined
}

const loadCurrentWorkspaceSettingLayout = async (
    executor: DbExecutor,
    schemaName: string,
    lock: boolean
): Promise<CurrentWorkspaceSettingLayout | null> => {
    const rows = await findDefaultWorkspaceSettingLayouts(executor, schemaName, lock)
    if (rows.length > 1) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound,
            'The current Application layout is ambiguous'
        )
    }
    return rows[0] ?? null
}

export const resolveWorkspaceSettingAddresses = async (
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string },
    addresses: WorkspaceSettingAddress[],
    lockLayout: boolean,
    effectiveLayout?: EffectiveWorkspaceLayout | null
): Promise<ResolvedWorkspaceSettingAddress[]> => {
    const normalizedAddresses = addresses.map((address) => workspaceSettingAddressSchema.parse(address))
    const resolution = await resolveWorkspaceSettingAddressRows(executor, input, normalizedAddresses, lockLayout, effectiveLayout)
    if (!resolution.ok) {
        const messageByReason = {
            'layout-ambiguous': 'The current Application layout is ambiguous',
            'layout-changed': 'The current Application layout changed while resolving the widget setting target',
            'layout-unavailable': 'The current Application layout is unavailable',
            'widget-missing': 'A widget setting target is not present in the current Application layout',
            'widget-inactive': 'A widget setting target is no longer active in the current Application layout'
        } as const
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, messageByReason[resolution.reason])
    }
    return resolution.addresses
}

export async function resolveWorkspaceSettingAddress(
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string; address: WorkspaceSettingAddress }
): Promise<ResolvedWorkspaceSettingAddress> {
    const addresses = await resolveWorkspaceSettingAddresses(executor, input, [input.address], true)
    const resolved = addresses[0]
    if (!resolved) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Workspace setting target not found')
    }
    return resolved
}

export async function resolveWorkspaceSettingAddressesForWorkspace(
    executor: DbExecutor,
    input: { schemaName: string; workspaceId: string; addresses: WorkspaceSettingAddress[] }
): Promise<ResolvedWorkspaceSettingAddress[]> {
    return resolveWorkspaceSettingAddresses(executor, input, input.addresses, true)
}

const createLayoutToken = (schemaName: string, layout: CurrentWorkspaceSettingLayout | null): string | null => {
    if (!layout) return null
    return createHash('sha256').update(`${schemaName}\u0000${layout.id}\u0000${layout.version}`).digest('hex')
}

const createEffectiveWorkspaceLayoutToken = (schemaName: string, layout: EffectiveWorkspaceLayout['layout']): string =>
    createHash('sha256')
        .update(`${schemaName}\u0000${layout.id}\u0000${layout.version ?? ''}\u0000${layout.effectiveHash}`)
        .digest('hex')

const normalizeWorkspaceStyleColors = (value: unknown): string[] | null => {
    const defaults = interpretationNetworkCellStylePolicySchema.parse(undefined)
    const parsed = interpretationNetworkCellStylePolicySchema.safeParse({ ...defaults, allowedColors: value })
    return parsed.success ? parsed.data.allowedColors : null
}

const parseWorkspaceCellStylePolicy = (value: unknown): InterpretationNetworkCellStylePolicy => {
    const parsed = interpretationNetworkCellStylePolicySchema.safeParse(value)
    if (!parsed.success) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
            'The active widget has an invalid cell style policy'
        )
    }
    return parsed.data
}

const getWorkspaceWidgetSettingValue = (
    policy: InterpretationNetworkCellStylePolicy,
    key: InterpretationNetworkCellStyleWorkspaceSettingKey
): unknown => {
    const path = getPolicySettingPath(key)
    if (!path) return undefined
    let value: unknown = policy
    for (const part of path) {
        if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, part)) return undefined
        value = value[part]
    }
    return value
}

const applyWorkspaceWidgetOverride = (
    policy: InterpretationNetworkCellStylePolicy,
    address: WorkspaceSettingAddress,
    value: unknown
): InterpretationNetworkCellStylePolicy => {
    const path = getPolicySettingPath(address.key)
    if (!path || address.target.kind !== 'widget') return policy
    let normalizedValue = value
    if (path[path.length - 1] === 'allowedColors') {
        normalizedValue = normalizeWorkspaceStyleColors(value)
        if (!normalizedValue) {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
                `Workspace setting "${addressLabel(address)}" has an invalid color allowlist`
            )
        }
    }
    const next: Record<string, unknown> = { ...policy }
    let cursor = next
    path.slice(0, -1).forEach((part) => {
        const child = cursor[part]
        cursor[part] = isRecord(child) ? { ...child } : {}
        cursor = cursor[part] as Record<string, unknown>
    })
    cursor[path[path.length - 1] as string] = normalizedValue
    const parsed = interpretationNetworkCellStylePolicySchema.safeParse(next)
    if (!parsed.success) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
            `Workspace setting "${addressLabel(address)}" has an invalid value`
        )
    }
    return parsed.data
}

export const resolveEffectiveWorkspaceLayout = async (
    executor: DbExecutor,
    input: { authContext: WorkspaceSettingsResolverAuthContext; runtimeTarget: RuntimeTarget; workspaceId: string }
): Promise<EffectiveWorkspaceLayout> => {
    const target = runtimeTargetSchema.safeParse(input.runtimeTarget)
    if (!target.success || target.data.applicationId !== input.authContext.applicationId || target.data.workspaceId !== input.workspaceId) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Workspace runtime target is invalid')
    }

    try {
        const resolved = await resolveEffectiveLayoutStructureForRequest(executor, input.authContext, target.data)
        return {
            layout: {
                id: resolved.layout.id,
                version: resolved.layout.version ?? null,
                effectiveHash: resolved.effectiveHash
            },
            widgets: resolved.widgets.map((widget) => ({
                id: widget.id,
                instanceKey: widget.instanceKey,
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                semanticRegion: widget.semanticRegion,
                config: widget.config,
                isActive: widget.isActive
            }))
        }
    } catch (error) {
        if (error instanceof EffectiveLayoutError) {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound,
                'Current Application layout is unavailable'
            )
        }
        throw error
    }
}

const buildEffectiveWorkspaceWidgetConfig = (input: {
    widget: EffectiveWorkspaceLayout['widgets'][number]
    applicationSettings: Record<string, unknown>
    overrides: WorkspaceSettingOverrideRow[]
    layoutToken: string
}): EffectiveWorkspaceWidgetConfig => {
    const { widget } = input
    if (widget.widgetKey !== WORKSPACE_MATRIX_WIDGET_KEY) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Widget setting target not found')
    }
    if (!isRecord(widget.config)) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid, 'The active widget config is invalid')
    }
    let policy = parseWorkspaceCellStylePolicy(widget.config.cellStylePolicy)
    const widgetOverrides = input.overrides.filter((row) => row.target.kind === 'widget' && row.target.instanceKey === widget.instanceKey)
    for (const row of widgetOverrides) {
        if (!isWorkspaceSettingAddressAllowed(input.applicationSettings, row) || !getCellStyleSettingPath(row.key)) continue
        policy = applyWorkspaceWidgetOverride(policy, row, parseWorkspaceSettingValue(row, row.value))
    }
    const config = { ...widget.config, cellStylePolicy: policy }
    return {
        target: { kind: 'widget', instanceKey: widget.instanceKey },
        widgetKey: widget.widgetKey,
        zone: widget.zone,
        semanticRegion: widget.semanticRegion,
        config,
        cellStylePolicy: policy,
        layoutToken: input.layoutToken
    }
}

const resolveEffectiveWorkspaceWidgetConfigsInTransaction = (input: {
    layout: EffectiveWorkspaceLayout
    applicationSettings: Record<string, unknown>
    overrides: WorkspaceSettingOverrideRow[]
    layoutToken: string
    instanceKey?: string
}): EffectiveWorkspaceWidgetConfig[] => {
    const widgets = input.layout.widgets.filter(
        (widget) =>
            widget.isActive &&
            widget.widgetKey === WORKSPACE_MATRIX_WIDGET_KEY &&
            (input.instanceKey === undefined || widget.instanceKey === input.instanceKey)
    )
    if (input.instanceKey !== undefined && widgets.length !== 1) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Widget setting target not found')
    }
    return widgets.map((widget) =>
        buildEffectiveWorkspaceWidgetConfig({
            widget,
            applicationSettings: input.applicationSettings,
            overrides: input.overrides,
            layoutToken: input.layoutToken
        })
    )
}

export async function resolveEffectiveWorkspaceWidgetConfig(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        authContext: WorkspaceSettingsResolverAuthContext
        runtimeTarget: RuntimeTarget
        instanceKey: string
        /** Internal placement binding used by runtime mutation resolvers. */
        expectedWidgetId?: string
    }
): Promise<EffectiveWorkspaceWidgetConfig> {
    const instanceKey = layoutInstanceKeySchema.safeParse(input.instanceKey)
    if (!instanceKey.success) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Widget setting target not found')
    }

    return executor.transaction(async (tx) => {
        const layout = await resolveEffectiveWorkspaceLayout(tx, input)
        const layoutToken = createEffectiveWorkspaceLayoutToken(input.schemaName, layout.layout)
        const overrides = await listWorkspaceSettingOverrides(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId,
            layoutId: layout.layout.id
        })
        const configs = resolveEffectiveWorkspaceWidgetConfigsInTransaction({
            layout,
            applicationSettings: input.applicationSettings,
            overrides,
            layoutToken,
            instanceKey: instanceKey.data
        })
        const config = configs[0]
        if (!config) {
            throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Widget setting target not found')
        }
        if (input.expectedWidgetId) {
            const resolvedWidget = layout.widgets.find((widget) => widget.isActive && widget.instanceKey === instanceKey.data)
            if (!resolvedWidget || resolvedWidget.id !== input.expectedWidgetId || resolvedWidget.widgetKey !== config.widgetKey) {
                throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Widget setting target not found')
            }
        }
        return config
    })
}

export const listRuntimeWorkspaceSettingsInTransaction = async (
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        authContext?: WorkspaceSettingsResolverAuthContext
        runtimeTarget?: RuntimeTarget
    }
): Promise<RuntimeWorkspaceSettingsSnapshot> => {
    const effectiveLayout =
        input.authContext && input.runtimeTarget
            ? await resolveEffectiveWorkspaceLayout(executor, {
                  authContext: input.authContext,
                  runtimeTarget: input.runtimeTarget,
                  workspaceId: input.workspaceId
              })
            : null
    const currentLayout = effectiveLayout ? null : await loadCurrentWorkspaceSettingLayout(executor, input.schemaName, true)
    const currentLayoutId = effectiveLayout?.layout.id ?? currentLayout?.id ?? null
    const overrides = await listWorkspaceSettingOverrides(executor, { ...input, layoutId: currentLayoutId })
    const globalOverrides = overrides.filter((override) => override.target.kind === 'global')
    const overridesByKey = new Map(globalOverrides.map((override) => [override.key, override]))
    const overrideValues: Record<string, unknown> = {}

    for (const override of globalOverrides) {
        overrideValues[override.key] = override.value
    }

    const items = listWorkspaceOverridableSettings().map((definition: UnifiedSettingDefinition) => {
        const address: WorkspaceSettingAddress = { key: definition.key, target: { kind: 'global' } }
        const allowed = isWorkspaceSettingAddressAllowed(input.applicationSettings, address)
        const persisted = overridesByKey.get(definition.key)
        const effective = resolveEffectiveSetting(definition, input.applicationSettings, allowed ? overrideValues : {})

        return {
            ...effective,
            target: { kind: 'global' as const },
            allowed,
            version: persisted?.version ?? null
        }
    })

    const widgetOverrides = overrides.filter(
        (override) => override.target.kind === 'widget' && isWorkspaceSettingAddressAllowed(input.applicationSettings, override)
    )
    const layoutToken = effectiveLayout
        ? createEffectiveWorkspaceLayoutToken(input.schemaName, effectiveLayout.layout)
        : createLayoutToken(input.schemaName, currentLayout)
    if (effectiveLayout && !layoutToken) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound, 'Current Application layout is unavailable')
    }
    const effectiveWidgetConfigs = effectiveLayout
        ? resolveEffectiveWorkspaceWidgetConfigsInTransaction({
              layout: effectiveLayout,
              applicationSettings: input.applicationSettings,
              overrides: widgetOverrides,
              layoutToken: layoutToken as string
          })
        : []

    const widgetSettings: RuntimeWorkspaceWidgetSetting[] = effectiveLayout
        ? effectiveLayout.widgets
              .filter((widget) => widget.isActive && widget.widgetKey === WORKSPACE_MATRIX_WIDGET_KEY)
              .flatMap((widget) => {
                  const applicationPolicy = parseWorkspaceCellStylePolicy(widget.config.cellStylePolicy)
                  return Object.keys(CELL_STYLE_SETTING_PATHS)
                      .filter(isInterpretationNetworkCellStyleWorkspaceSettingKey)
                      .flatMap((key) => {
                          const address: WorkspaceSettingAddress = { key, target: { kind: 'widget', instanceKey: widget.instanceKey } }
                          if (!isWorkspaceSettingAddressAllowed(input.applicationSettings, address)) return []
                          const persisted = widgetOverrides.find(
                              (override) =>
                                  override.target.kind === 'widget' &&
                                  override.target.instanceKey === widget.instanceKey &&
                                  override.key === key
                          )
                          return [
                              {
                                  ...address,
                                  target: address.target as { kind: 'widget'; instanceKey: string },
                                  value: persisted
                                      ? parseWorkspaceSettingValue(address, persisted.value)
                                      : getWorkspaceWidgetSettingValue(applicationPolicy, key),
                                  source: persisted ? ('workspace' as const) : ('application' as const),
                                  isInherited: !persisted,
                                  allowed: true as const,
                                  version: persisted?.version ?? null
                              }
                          ]
                      })
              })
        : []

    return {
        items,
        widgetSettings,
        widgetOverrides,
        layoutToken,
        effectiveWidgetConfigs
    }
}

export async function listRuntimeWorkspaceSettings(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        authContext?: WorkspaceSettingsResolverAuthContext
        runtimeTarget?: RuntimeTarget
    }
): Promise<RuntimeWorkspaceSettingsSnapshot> {
    return executor.transaction((tx) => listRuntimeWorkspaceSettingsInTransaction(tx, input))
}
