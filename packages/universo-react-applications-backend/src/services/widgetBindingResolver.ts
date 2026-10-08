import {
    validateWidgetBindings,
    type WidgetBindingDefinitionContract,
    type WidgetBindingProjectionField,
    type WidgetBindingSlotDefinition,
    type WidgetBindingTarget,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import type { WidgetBindingRecordQuery } from './widgetBindingQuery'

export type WidgetBindingRecord = Readonly<Record<string, unknown>>

export interface LoadedWidgetBindingRecord {
    /** Persistence identity, retained internally for authorized runtime row actions. */
    readonly recordId: string
    /** Persistence version used only by explicit optimistic-concurrency action DTOs. */
    readonly version?: number
    /** Values keyed by the registry's semantic projection field. */
    readonly data: WidgetBindingRecord
}

/**
 * Runtime record access is injected. Implementations must apply workspace,
 * lifecycle, selector, visibility, ordering, projection, and row limits in SQL
 * before returning rows. Dynamic table/column identifiers must come only from
 * validated application metadata and use the shared identifier quoting API.
 */
export type WidgetBindingRecordLoader = (
    query: WidgetBindingRecordQuery
) => readonly LoadedWidgetBindingRecord[] | Promise<readonly LoadedWidgetBindingRecord[]>

export type ResolvedWidgetBindingTarget = {
    slot: string
    entityKind: WidgetBindingTarget['entityKind']
    entityCodename: string
    semanticKey: string
    parentSemanticKey?: string
    data: WidgetBindingRecord
}

export interface WidgetBindingRuntimeMutationIdentity {
    readonly recordId: string
    readonly version?: number
}

export class WidgetBindingResolutionError extends Error {
    constructor(
        public readonly reason: 'invalid-contract' | 'target-unavailable' | 'projection-invalid',
        message = 'Widget Entity binding could not be resolved'
    ) {
        super(message)
        this.name = 'WidgetBindingResolutionError'
    }
}

interface InternalResolvedTarget {
    readonly recordId: string
    readonly value: ResolvedWidgetBindingTarget
}

const getProjection = (slot: WidgetBindingSlotDefinition, field: string): WidgetBindingProjectionField => {
    const requirement = slot.requirements.components.find((candidate) => candidate.field === field)
    if (!requirement) throw new WidgetBindingResolutionError('projection-invalid')
    return { field: requirement.field, componentCodename: requirement.componentCodename }
}

const assertVisible = (slot: WidgetBindingSlotDefinition, data: WidgetBindingRecord): void => {
    if (slot.visibilityField && data[slot.visibilityField] !== true) {
        throw new WidgetBindingResolutionError('target-unavailable')
    }
}

const projectRecord = (slot: WidgetBindingSlotDefinition, record: LoadedWidgetBindingRecord): WidgetBindingRecord => {
    const data: Record<string, unknown> = {}
    for (const requirement of slot.requirements.components) {
        const value = record.data[requirement.field]
        if (value === undefined || value === null) {
            if (requirement.required) throw new WidgetBindingResolutionError('target-unavailable')
            continue
        }
        data[requirement.field] = value
    }
    assertVisible(slot, data)
    return data
}

const getOptionalSemanticKeyField = (slot: WidgetBindingSlotDefinition): string | null => {
    const keys = slot.requirements.components.filter(({ semanticKey }) => semanticKey === true)
    if (keys.length > 1) throw new WidgetBindingResolutionError('projection-invalid')
    return keys[0]?.field ?? null
}

const readVersion = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined

const runtimeMutationIdentityByTarget = new WeakMap<ResolvedWidgetBindingTarget, WidgetBindingRuntimeMutationIdentity>()

/** Read persistence identity kept out of ordinary semantic widget data. */
export const getWidgetBindingRuntimeMutationIdentity = (
    target: ResolvedWidgetBindingTarget
): WidgetBindingRuntimeMutationIdentity | undefined => runtimeMutationIdentityByTarget.get(target)

/** Preserve private row identity when a trusted projector adds derived semantic data. */
export const withWidgetBindingRuntimeData = (
    target: ResolvedWidgetBindingTarget,
    data: WidgetBindingRecord
): ResolvedWidgetBindingTarget => {
    const projected = { ...target, data }
    const identity = runtimeMutationIdentityByTarget.get(target)
    if (identity) runtimeMutationIdentityByTarget.set(projected, identity)
    return projected
}

const retainRuntimeMutationIdentity = (row: LoadedWidgetBindingRecord, value: ResolvedWidgetBindingTarget): InternalResolvedTarget => {
    const version = readVersion(row.version)
    runtimeMutationIdentityByTarget.set(value, {
        recordId: row.recordId,
        ...(version === undefined ? {} : { version })
    })
    return { recordId: row.recordId, value }
}

const getOrderedQuery = (slot: WidgetBindingSlotDefinition): Extract<WidgetBindingRecordQuery, { kind: 'record-set' }>['ordered'] => {
    if (!slot.maxResolvedRecords || !slot.orderByField) throw new WidgetBindingResolutionError('projection-invalid')
    const order = getProjection(slot, slot.orderByField)
    const visibility = slot.visibilityField ? getProjection(slot, slot.visibilityField) : undefined
    return {
        orderByComponentCodename: order.componentCodename,
        ...(visibility ? { visibilityComponentCodename: visibility.componentCodename } : {}),
        limit: slot.maxResolvedRecords
    }
}

const assertLoadedRows = (rows: readonly LoadedWidgetBindingRecord[], max: number): void => {
    if (rows.length > max) throw new WidgetBindingResolutionError('target-unavailable')
    const ids = new Set<string>()
    for (const row of rows) {
        if (!row.recordId || ids.has(row.recordId)) throw new WidgetBindingResolutionError('target-unavailable')
        ids.add(row.recordId)
    }
}

/**
 * Resolve registry-declared bindings to bounded semantic data. Persistence,
 * authorization, metadata checks, and physical table access stay in loaders.
 */
export const resolveWidgetBindingTargets = (
    definition: WidgetBindingDefinitionContract,
    rawBindings: unknown,
    loadRecords: WidgetBindingRecordLoader
): Promise<ResolvedWidgetBindingTarget[]> => {
    let bindings: ReturnType<typeof validateWidgetBindings>
    try {
        bindings = validateWidgetBindings(definition, rawBindings)
    } catch {
        throw new WidgetBindingResolutionError('invalid-contract')
    }

    return resolveValidatedWidgetBindingTargets(definition, bindings, loadRecords)
}

/** Resolve bindings already validated at the caller's trust boundary. */
export const resolveValidatedWidgetBindingTargets = async (
    definition: WidgetBindingDefinitionContract,
    bindings: WidgetEntityBindingEnvelope,
    loadRecords: WidgetBindingRecordLoader
): Promise<ResolvedWidgetBindingTarget[]> => {
    const slotDefinitions = new Map((definition.bindingSlots ?? []).map((slot) => [slot.key, slot]))
    const bindingBySlot = new Map(bindings.slots.map((slot) => [slot.slot, slot]))
    const resolvedBySlot = new Map<string, InternalResolvedTarget[]>()
    const active = new Set<string>()

    const resolveSlot = async (slotKey: string): Promise<InternalResolvedTarget[]> => {
        const cached = resolvedBySlot.get(slotKey)
        if (cached) return cached
        const slotDefinition = slotDefinitions.get(slotKey)
        const binding = bindingBySlot.get(slotKey)
        if (!slotDefinition || !binding || active.has(slotKey)) throw new WidgetBindingResolutionError('invalid-contract')
        active.add(slotKey)

        const output: InternalResolvedTarget[] = []
        for (const target of binding.targets) {
            const projection = slotDefinition.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
            if (target.selector.kind === 'semantic-key') {
                const selectorProjection = getProjection(slotDefinition, target.selector.field)
                const rows = await loadRecords({
                    kind: 'semantic-key',
                    target,
                    slot: slotKey,
                    projection,
                    selector: {
                        componentCodename: selectorProjection.componentCodename,
                        value: target.selector.value
                    },
                    limit: 2
                })
                assertLoadedRows(rows, 2)
                if (rows.length !== 1) throw new WidgetBindingResolutionError('target-unavailable')
                const row = rows[0]
                const data = projectRecord(slotDefinition, row)
                if (data[target.selector.field] !== target.selector.value) throw new WidgetBindingResolutionError('target-unavailable')
                output.push(
                    retainRuntimeMutationIdentity(row, {
                        slot: slotKey,
                        entityKind: target.entityKind,
                        entityCodename: target.entityCodename,
                        semanticKey: target.selector.value,
                        data
                    })
                )
                continue
            }

            const ordered = getOrderedQuery(slotDefinition)
            if (target.selector.kind === 'record-set' || target.selector.kind === 'learner-enrollment-set') {
                const rows =
                    target.selector.kind === 'learner-enrollment-set'
                        ? await loadRecords({
                              kind: 'learner-enrollment-set',
                              target,
                              slot: slotKey,
                              projection,
                              selector: { targetKind: target.selector.targetKind },
                              ordered
                          })
                        : await loadRecords({ kind: 'record-set', target, slot: slotKey, projection, ordered })
                assertLoadedRows(rows, ordered.limit)
                const semanticKeyField = getOptionalSemanticKeyField(slotDefinition)
                const seenKeys = new Set<string>()
                for (const [index, row] of rows.entries()) {
                    const data = projectRecord(slotDefinition, row)
                    const semanticKey = semanticKeyField ? data[semanticKeyField] : `row-${index + 1}`
                    if (typeof semanticKey !== 'string' || !semanticKey || seenKeys.has(semanticKey)) {
                        throw new WidgetBindingResolutionError('target-unavailable')
                    }
                    seenKeys.add(semanticKey)
                    output.push(
                        retainRuntimeMutationIdentity(row, {
                            slot: slotKey,
                            entityKind: target.entityKind,
                            entityCodename: target.entityCodename,
                            semanticKey,
                            data
                        })
                    )
                }
                continue
            }

            const relation = slotDefinition.relation
            if (!relation || relation.parentSlot !== target.selector.parentSlot) {
                throw new WidgetBindingResolutionError('invalid-contract')
            }
            const parents = await resolveSlot(relation.parentSlot)
            if (parents.length === 0) continue
            const parentBinding = bindingBySlot.get(relation.parentSlot)
            if (!parentBinding || parentBinding.targets.length !== 1) throw new WidgetBindingResolutionError('invalid-contract')
            const parentsById = new Map(parents.map(({ recordId, value }) => [recordId, value.semanticKey]))
            const relationProjection = getProjection(slotDefinition, relation.field)
            const rows = await loadRecords({
                kind: 'relation-set',
                target,
                slot: slotKey,
                projection,
                selector: {
                    relationComponentCodename: relationProjection.componentCodename,
                    parentRecordIds: [...parentsById.keys()],
                    parentTarget: parentBinding.targets[0]
                },
                ordered
            })
            assertLoadedRows(rows, ordered.limit)
            const semanticKeyField = getOptionalSemanticKeyField(slotDefinition)
            const seenKeys = new Set<string>()
            for (const [index, row] of rows.entries()) {
                const data = projectRecord(slotDefinition, row)
                const parentSemanticKey =
                    typeof data[relation.field] === 'string' ? parentsById.get(data[relation.field] as string) : undefined
                const semanticKey = semanticKeyField ? data[semanticKeyField] : `row-${index + 1}`
                if (!parentSemanticKey || typeof semanticKey !== 'string' || !semanticKey || seenKeys.has(semanticKey)) {
                    throw new WidgetBindingResolutionError('target-unavailable')
                }
                seenKeys.add(semanticKey)
                output.push(
                    retainRuntimeMutationIdentity(row, {
                        slot: slotKey,
                        entityKind: target.entityKind,
                        entityCodename: target.entityCodename,
                        semanticKey,
                        parentSemanticKey,
                        data: { ...data, [relation.field]: parentSemanticKey }
                    })
                )
            }
        }

        active.delete(slotKey)
        resolvedBySlot.set(slotKey, output)
        return output
    }

    const results: ResolvedWidgetBindingTarget[] = []
    for (const slot of definition.bindingSlots ?? []) {
        if (bindingBySlot.has(slot.key)) results.push(...(await resolveSlot(slot.key)).map(({ value }) => value))
    }
    return results
}
