import { database, type DbExecutor } from '@universo-react/utils'
import type {
    RuntimeTarget,
    WorkspaceSettingOverrideInput,
    WorkspaceSettingResetInput,
    WorkspaceSettingTarget
} from '@universo-react/types'
import {
    allocateWorkspaceSettingId,
    findActiveWorkspaceSetting,
    findLatestWorkspaceSettingVersion,
    insertWorkspaceSettingRow,
    lockInterpretationNetworkCellStylePolicy,
    lockWorkspaceSetting as acquireWorkspaceSettingStoreLock,
    retireWorkspaceSettingRow,
    updateWorkspaceSettingRow
} from '../persistence/workspaceSettingsStore'
import {
    addressLabel,
    assertExpectedVersion,
    assertWorkspaceSettingAddressAllowed,
    compareResolvedAddresses,
    getCellStyleSettingPath,
    normalizeExpectedVersion,
    normalizeVersion,
    parseWorkspaceSettingValue,
    WORKSPACE_SETTINGS_ERROR_CODES,
    WorkspaceSettingsError,
    workspaceSettingAddressIdentity,
    workspaceSettingAddressSchema,
    workspaceSettingBatchUpdateSchema,
    type ResolvedWorkspaceSettingAddress,
    type RuntimeWorkspaceSettingsSnapshot
} from './workspaceSettingsCore'
import type { WorkspaceSettingOverrideRow, WorkspaceSettingsResolverAuthContext } from '../shared/workspaceSettingsContracts'
import {
    listRuntimeWorkspaceSettingsInTransaction,
    resolveEffectiveWorkspaceLayout,
    resolveWorkspaceSettingAddress,
    resolveWorkspaceSettingAddresses
} from './workspaceSettingsRuntime'

const readActiveWorkspaceSetting = async (
    executor: DbExecutor,
    schemaName: string,
    address: ResolvedWorkspaceSettingAddress
): Promise<{ id: string; version: string | number } | null> => findActiveWorkspaceSetting(executor, schemaName, address)

const readLatestWorkspaceSettingVersion = async (
    executor: DbExecutor,
    schemaName: string,
    address: ResolvedWorkspaceSettingAddress
): Promise<number> => {
    const latestVersion = Number((await findLatestWorkspaceSettingVersion(executor, schemaName, address)) ?? 0)
    if (!Number.isSafeInteger(latestVersion) || latestVersion < 0) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${addressLabel(address)}" has an invalid stored version`
        )
    }
    return latestVersion
}

const upsertResolvedWorkspaceSettingOverride = async (
    executor: DbExecutor,
    schemaName: string,
    address: ResolvedWorkspaceSettingAddress,
    value: unknown,
    expectedVersion: number | undefined,
    actorUserId: string | null | undefined
): Promise<WorkspaceSettingOverrideRow> => {
    const existing = await readActiveWorkspaceSetting(executor, schemaName, address)

    if (existing) {
        const currentVersion = normalizeVersion(existing.version)
        assertExpectedVersion({ address, expectedVersion, currentVersion })
        const expectedVersionForUpdate = normalizeExpectedVersion(expectedVersion) ?? currentVersion

        const updated = await updateWorkspaceSettingRow(executor, {
            schemaName,
            address,
            id: existing.id,
            value,
            actorUserId,
            expectedVersion: expectedVersionForUpdate
        })
        if (!updated) {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
                `Workspace setting "${addressLabel(address)}" version conflict`
            )
        }

        return {
            key: updated.key,
            target: address.target,
            value: updated.value,
            version: normalizeVersion(updated.version)
        }
    }

    assertExpectedVersion({ address, expectedVersion })
    const latestVersion = await readLatestWorkspaceSettingVersion(executor, schemaName, address)
    const nextVersion = latestVersion + 1
    if (!Number.isSafeInteger(nextVersion)) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${addressLabel(address)}" version limit reached`
        )
    }
    const id = await allocateWorkspaceSettingId(executor)
    if (!id) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingNotFound, 'Could not allocate workspace setting identity')
    }

    try {
        const inserted = await insertWorkspaceSettingRow(executor, {
            schemaName,
            address,
            id,
            value,
            version: nextVersion,
            actorUserId
        })
        if (!inserted) {
            throw new WorkspaceSettingsError(
                WORKSPACE_SETTINGS_ERROR_CODES.settingNotFound,
                `Workspace setting "${addressLabel(address)}" was not persisted`
            )
        }

        return {
            key: inserted.key,
            target: address.target,
            value: inserted.value,
            version: normalizeVersion(inserted.version)
        }
    } catch (error) {
        if (error instanceof WorkspaceSettingsError) throw error
        if (!database.isUniqueViolation(error)) throw error

        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${addressLabel(address)}" version conflict`
        )
    }
}

const resetResolvedWorkspaceSettingOverride = async (
    executor: DbExecutor,
    schemaName: string,
    address: ResolvedWorkspaceSettingAddress,
    expectedVersion: number | undefined,
    actorUserId: string | null | undefined
): Promise<void> => {
    const existing = await readActiveWorkspaceSetting(executor, schemaName, address)
    if (!existing) {
        assertExpectedVersion({ address, expectedVersion })
        return
    }

    const currentVersion = normalizeVersion(existing.version)
    assertExpectedVersion({ address, expectedVersion, currentVersion })
    const expectedVersionForReset = normalizeExpectedVersion(expectedVersion) ?? currentVersion

    const updated = await retireWorkspaceSettingRow(executor, {
        schemaName,
        address,
        id: existing.id,
        actorUserId,
        expectedVersion: expectedVersionForReset
    })

    if (!updated) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${addressLabel(address)}" version conflict`
        )
    }
}

export async function upsertWorkspaceSettingOverride(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        key: string
        target: WorkspaceSettingTarget
        value: unknown
        expectedVersion?: number
        actorUserId?: string | null
    }
): Promise<WorkspaceSettingOverrideRow> {
    const address = workspaceSettingAddressSchema.parse({ key: input.key, target: input.target })
    assertWorkspaceSettingAddressAllowed(input.applicationSettings, address)
    const value = parseWorkspaceSettingValue(address, input.value)
    return executor.transaction(async (tx) => {
        if (getCellStyleSettingPath(address.key)) {
            await lockInterpretationNetworkCellStylePolicy(tx, input.schemaName, input.workspaceId)
        }
        const resolved = await resolveWorkspaceSettingAddress(tx, { schemaName: input.schemaName, workspaceId: input.workspaceId, address })
        await acquireWorkspaceSettingStoreLock(tx, input.schemaName, resolved)
        return upsertResolvedWorkspaceSettingOverride(tx, input.schemaName, resolved, value, input.expectedVersion, input.actorUserId)
    })
}

export async function resetWorkspaceSettingOverride(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        key: string
        target: WorkspaceSettingTarget
        expectedVersion?: number
        actorUserId?: string | null
    }
): Promise<void> {
    const address = workspaceSettingAddressSchema.parse({ key: input.key, target: input.target })
    assertWorkspaceSettingAddressAllowed(input.applicationSettings, address)
    return executor.transaction(async (tx) => {
        if (getCellStyleSettingPath(address.key)) {
            await lockInterpretationNetworkCellStylePolicy(tx, input.schemaName, input.workspaceId)
        }
        const resolved = await resolveWorkspaceSettingAddress(tx, { schemaName: input.schemaName, workspaceId: input.workspaceId, address })
        await acquireWorkspaceSettingStoreLock(tx, input.schemaName, resolved)
        await resetResolvedWorkspaceSettingOverride(tx, input.schemaName, resolved, input.expectedVersion, input.actorUserId)
    })
}

export async function updateWorkspaceSettingOverrides(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        settings: WorkspaceSettingOverrideInput[]
        resets: WorkspaceSettingResetInput[]
        authContext?: WorkspaceSettingsResolverAuthContext
        runtimeTarget?: RuntimeTarget
        actorUserId?: string | null
    }
): Promise<RuntimeWorkspaceSettingsSnapshot> {
    const parsedBatch = workspaceSettingBatchUpdateSchema.safeParse({ settings: input.settings, resets: input.resets })
    if (!parsedBatch.success) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingValueInvalid, 'Workspace settings batch is invalid')
    }

    return executor.transaction(async (tx) => {
        const operations = [
            ...parsedBatch.data.settings.map((setting) => ({
                kind: 'setting' as const,
                address: workspaceSettingAddressSchema.parse({ key: setting.key, target: setting.target }),
                setting
            })),
            ...parsedBatch.data.resets.map((reset) => ({
                kind: 'reset' as const,
                address: workspaceSettingAddressSchema.parse({ key: reset.key, target: reset.target }),
                reset
            }))
        ]
        const parsedValues = new Map<string, unknown>()
        for (const operation of operations) {
            assertWorkspaceSettingAddressAllowed(input.applicationSettings, operation.address)
            if (operation.kind === 'setting') {
                parsedValues.set(
                    workspaceSettingAddressIdentity(operation.address),
                    parseWorkspaceSettingValue(operation.address, operation.setting.value)
                )
            }
        }

        if (operations.some((operation) => getCellStyleSettingPath(operation.address.key))) {
            await lockInterpretationNetworkCellStylePolicy(tx, input.schemaName, input.workspaceId)
        }

        const hasWidgetOperations = operations.some((operation) => operation.address.target.kind === 'widget')
        const effectiveLayout =
            hasWidgetOperations && input.authContext && input.runtimeTarget
                ? await resolveEffectiveWorkspaceLayout(tx, {
                      authContext: input.authContext,
                      runtimeTarget: input.runtimeTarget,
                      workspaceId: input.workspaceId
                  })
                : null
        const resolvedAddresses = await resolveWorkspaceSettingAddresses(
            tx,
            { schemaName: input.schemaName, workspaceId: input.workspaceId },
            operations.map((operation) => operation.address),
            true,
            effectiveLayout
        )
        const resolvedByAddress = new Map(resolvedAddresses.map((address) => [workspaceSettingAddressIdentity(address), address]))
        const resolvedOperations = operations
            .map((operation) => {
                const resolved = resolvedByAddress.get(workspaceSettingAddressIdentity(operation.address))
                if (!resolved) {
                    throw new WorkspaceSettingsError(
                        WORKSPACE_SETTINGS_ERROR_CODES.settingTargetNotFound,
                        `Workspace setting "${addressLabel(operation.address)}" target not found`
                    )
                }
                return { ...operation, resolved }
            })
            .sort((left, right) => compareResolvedAddresses(left.resolved, right.resolved))

        for (const operation of resolvedOperations) {
            await acquireWorkspaceSettingStoreLock(tx, input.schemaName, operation.resolved)
        }

        for (const operation of resolvedOperations) {
            if (operation.kind === 'setting') {
                const value = parsedValues.get(workspaceSettingAddressIdentity(operation.address))
                await upsertResolvedWorkspaceSettingOverride(
                    tx,
                    input.schemaName,
                    operation.resolved,
                    value,
                    operation.setting.expectedVersion,
                    input.actorUserId
                )
            } else {
                await resetResolvedWorkspaceSettingOverride(
                    tx,
                    input.schemaName,
                    operation.resolved,
                    operation.reset.expectedVersion,
                    input.actorUserId
                )
            }
        }

        return listRuntimeWorkspaceSettingsInTransaction(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId,
            applicationSettings: input.applicationSettings,
            authContext: input.authContext,
            runtimeTarget: input.runtimeTarget
        })
    })
}
