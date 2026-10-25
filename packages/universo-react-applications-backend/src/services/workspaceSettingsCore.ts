import { z } from 'zod'
import {
    INTERPRETATION_NETWORK_CELL_STYLE_WORKSPACE_SETTING_PATHS,
    interpretationNetworkCellStylePolicySchema,
    isInterpretationNetworkCellStyleWorkspaceSettingKey,
    parseUnifiedSettingValue,
    workspaceSettingAddressSchema as sharedWorkspaceSettingAddressSchema,
    workspaceSettingBatchUpdateSchema as sharedWorkspaceSettingBatchUpdateSchema,
    workspaceSettingOverrideSchema as sharedWorkspaceSettingOverrideSchema,
    workspaceSettingResetSchema as sharedWorkspaceSettingResetSchema,
    workspaceSettingTargetSchema as sharedWorkspaceSettingTargetSchema,
    type ApplicationLayoutZone,
    type EffectiveSetting,
    type InterpretationNetworkCellStylePolicy,
    type LayoutSemanticRegion,
    type WorkspaceSettingAddress,
    type WorkspaceSettingOverrideInput,
    type WorkspaceSettingResetInput,
    type WorkspaceSettingTarget
} from '@universo-react/types'
import { isWorkspaceSettingAddressAllowed, type WorkspaceSettingOverrideRow } from '../shared/workspaceSettingsContracts'

export type { WorkspaceSettingOverrideRow, WorkspaceSettingsResolverAuthContext } from '../shared/workspaceSettingsContracts'

export const workspaceSettingTargetSchema = sharedWorkspaceSettingTargetSchema
export const workspaceSettingAddressSchema = sharedWorkspaceSettingAddressSchema
export const workspaceSettingOverrideInputSchema = sharedWorkspaceSettingOverrideSchema
export const workspaceSettingResetInputSchema = sharedWorkspaceSettingResetSchema
export const workspaceSettingBatchUpdateSchema = sharedWorkspaceSettingBatchUpdateSchema

export type { WorkspaceSettingAddress, WorkspaceSettingOverrideInput, WorkspaceSettingResetInput, WorkspaceSettingTarget }

export const WORKSPACE_SETTINGS_ERROR_CODES = {
    settingNotAllowed: 'WORKSPACE_SETTING_NOT_ALLOWED',
    settingConflict: 'WORKSPACE_SETTING_VERSION_CONFLICT',
    settingNotFound: 'WORKSPACE_SETTING_NOT_FOUND',
    settingTargetNotFound: 'WORKSPACE_SETTING_TARGET_NOT_FOUND',
    settingValueInvalid: 'WORKSPACE_SETTING_VALUE_INVALID'
} as const

export type WorkspaceSettingsErrorCode = (typeof WORKSPACE_SETTINGS_ERROR_CODES)[keyof typeof WORKSPACE_SETTINGS_ERROR_CODES]

export class WorkspaceSettingsError extends Error {
    code: WorkspaceSettingsErrorCode

    constructor(code: WorkspaceSettingsErrorCode, message: string) {
        super(message)
        this.name = 'WorkspaceSettingsError'
        this.code = code
    }
}

export type RuntimeWorkspaceSetting = EffectiveSetting & {
    target: { kind: 'global' }
    allowed: boolean
    version: number | null
}

export type RuntimeWorkspaceWidgetSetting = WorkspaceSettingAddress & {
    target: { kind: 'widget'; instanceKey: string }
    value: unknown
    source: 'application' | 'workspace'
    isInherited: boolean
    allowed: true
    version: number | null
}

export type RuntimeWorkspaceSettingsSnapshot = {
    items: RuntimeWorkspaceSetting[]
    widgetSettings: RuntimeWorkspaceWidgetSetting[]
    widgetOverrides: WorkspaceSettingOverrideRow[]
    layoutToken: string | null
    effectiveWidgetConfigs: EffectiveWorkspaceWidgetConfig[]
}

export type ResolvedWorkspaceSettingAddress = {
    workspaceId: string
    key: string
    target: WorkspaceSettingTarget
    targetKind: 'global' | 'widget'
    targetOwnerId: string
    targetKey: string
}

export type EffectiveWorkspaceWidgetConfig = {
    target: { kind: 'widget'; instanceKey: string }
    widgetKey: string
    zone: ApplicationLayoutZone
    semanticRegion: LayoutSemanticRegion
    config: Record<string, unknown>
    cellStylePolicy: InterpretationNetworkCellStylePolicy
    layoutToken: string
}

export const CELL_STYLE_SETTING_PATHS = INTERPRETATION_NETWORK_CELL_STYLE_WORKSPACE_SETTING_PATHS

export const getCellStyleSettingPath = (key: string): readonly string[] | undefined =>
    isInterpretationNetworkCellStyleWorkspaceSettingKey(key) ? CELL_STYLE_SETTING_PATHS[key] : undefined

export const workspaceSettingAddressIdentity = (address: WorkspaceSettingAddress): string =>
    JSON.stringify([address.key, address.target.kind, address.target.kind === 'widget' ? address.target.instanceKey : ''])

export const normalizeVersion = (value: string | number | null | undefined): number => {
    const numeric = Number(value ?? 0)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

export const addressLabel = (address: WorkspaceSettingAddress): string =>
    address.target.kind === 'widget' ? `${address.key} @ ${address.target.instanceKey}` : address.key

export const compareResolvedAddresses = (left: ResolvedWorkspaceSettingAddress, right: ResolvedWorkspaceSettingAddress): number => {
    const leftTuple = [left.targetKind, left.targetOwnerId, left.targetKey, left.key]
    const rightTuple = [right.targetKind, right.targetOwnerId, right.targetKey, right.key]
    for (let index = 0; index < leftTuple.length; index += 1) {
        if (leftTuple[index] < rightTuple[index]) return -1
        if (leftTuple[index] > rightTuple[index]) return 1
    }
    return 0
}

export const normalizeExpectedVersion = (value: number | null | undefined): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined

export const assertExpectedVersion = (input: {
    address: WorkspaceSettingAddress
    expectedVersion?: number
    currentVersion?: number
}): void => {
    const expectedVersion = normalizeExpectedVersion(input.expectedVersion)
    const hasCurrentVersion = input.currentVersion !== undefined
    const hasProvidedVersion = input.expectedVersion !== undefined
    if (
        (hasProvidedVersion && expectedVersion === undefined) ||
        (hasCurrentVersion && expectedVersion !== input.currentVersion) ||
        (!hasCurrentVersion && expectedVersion !== undefined)
    ) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${addressLabel(input.address)}" version conflict`
        )
    }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const assertWorkspaceSettingAddressAllowed = (
    applicationSettings: Record<string, unknown>,
    address: WorkspaceSettingAddress
): void => {
    if (!isWorkspaceSettingAddressAllowed(applicationSettings, address)) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingNotAllowed,
            `Workspace setting "${addressLabel(address)}" is not allowed`
        )
    }
}

export const parseWorkspaceSettingValue = (addressInput: WorkspaceSettingAddress, value: unknown): unknown => {
    const parsedAddress = workspaceSettingAddressSchema.safeParse({ key: addressInput.key, target: addressInput.target })
    if (!parsedAddress.success) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid, 'Workspace setting address is invalid')
    }

    if (parsedAddress.data.target.kind === 'global') {
        try {
            return parseUnifiedSettingValue(parsedAddress.data.key, value)
        } catch {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
                `Workspace setting "${addressLabel(parsedAddress.data)}" has an invalid value`
            )
        }
    }

    const stylePath = getCellStyleSettingPath(parsedAddress.data.key)
    if (stylePath?.length === 2 && stylePath[0] === 'cellStylePolicy' && stylePath[1] === 'allowedColors') {
        const defaults = interpretationNetworkCellStylePolicySchema.parse(undefined)
        const parsedPolicy = interpretationNetworkCellStylePolicySchema.safeParse({ ...defaults, allowedColors: value })
        if (!parsedPolicy.success) {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
                `Workspace setting "${addressLabel(parsedAddress.data)}" has an invalid color allowlist`
            )
        }
        return parsedPolicy.data.allowedColors
    }
    if (stylePath && !z.boolean().safeParse(value).success) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
            `Workspace setting "${addressLabel(parsedAddress.data)}" must be a boolean`
        )
    }

    try {
        const serialized = JSON.stringify(value ?? null)
        return JSON.parse(serialized) as unknown
    } catch {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid,
            `Workspace setting "${addressLabel(parsedAddress.data)}" has an invalid JSON value`
        )
    }
}
