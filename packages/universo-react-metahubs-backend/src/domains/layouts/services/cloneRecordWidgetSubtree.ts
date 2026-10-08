import {
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    isCompatibleWidgetBindingEntity,
    validateWidgetBindings,
    type ApplicationTemplateKey,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils/database'
import { isUuidV7 } from '@universo-react/utils'
import { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubRecordsService } from '../../metahubs/services/MetahubRecordsService'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { prepareRecordCopy } from '../../metahubs/services/recordCopy'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { acquireWidgetBindingObjectLockByCodename } from '../widgetBindingPolicyStore'
import { findWidgetBindingRecordBySemanticKey } from '../widgetBindingsStore'
import { requireLayoutWidgetOwnership } from '../widgetOwnership'
import { findWidgetRecordCloneCandidatesBySemanticKey } from './widgetRecordCloneStore'

interface CloneRecordPlacement {
    readonly id: string
    readonly widgetKey: string
    readonly zone: string
    readonly config: Record<string, unknown>
}

interface CloneRecordBindingPlan {
    readonly widgetId: string
    readonly widgetKey: string
    readonly zone: string
    readonly originalConfig: Record<string, unknown>
    readonly slot: WidgetBindingSlotDefinition
    readonly target: {
        readonly entityCodename: string
        readonly selector: { readonly kind: 'semantic-key'; readonly field: string; readonly value: string }
    }
    readonly semanticKeyComponentCodename: string
}

const cloneRecordPolicyError = (widgetKey: string, reason: string): MetahubValidationError =>
    new MetahubValidationError('This widget has an unsupported record-copy binding', { widgetKey, reason })

const planCloneRecordBindings = (
    templateKey: ApplicationTemplateKey,
    placements: readonly CloneRecordPlacement[]
): CloneRecordBindingPlan[] => {
    const plans: CloneRecordBindingPlan[] = []

    for (const placement of placements) {
        const definition = requireLayoutWidgetOwnership(templateKey, placement.widgetKey, placement.config)
        if (definition.copyPolicy.binding !== 'clone-record') continue

        let decoded: ReturnType<typeof decodeWidgetConfigEnvelope>
        try {
            decoded = decodeWidgetConfigEnvelope(placement.config, {
                templateKey,
                widgetKey: placement.widgetKey,
                zone: placement.zone,
                requireBindings: true
            })
        } catch (error) {
            throw cloneRecordPolicyError(
                placement.widgetKey,
                error instanceof Error ? error.message : 'Stored widget configuration is malformed'
            )
        }

        const authoring = definition.authoring?.metahub
        const slots = definition.bindingSlots ?? []
        if (
            authoring?.duplicate !== 'clone-record' ||
            authoring.contentEditing !== 'single-record' ||
            slots.length === 0 ||
            (definition.bindingSlotFamilies?.length ?? 0) > 0
        ) {
            throw cloneRecordPolicyError(placement.widgetKey, 'Registry copy policy is not a fixed single-record contract')
        }

        let bindings: ReturnType<typeof validateWidgetBindings>
        try {
            bindings = validateWidgetBindings(definition, decoded.neutral.bindings)
        } catch (error) {
            throw cloneRecordPolicyError(
                placement.widgetKey,
                error instanceof Error ? error.message : 'Stored bindings do not match the server registry'
            )
        }

        for (const slot of slots) {
            const semanticKeyComponents = slot.requirements.components.filter(({ semanticKey }) => semanticKey === true)
            const binding = bindings.slots.find(({ slot: slotKey }) => slotKey === slot.key)
            const target = binding?.targets.length === 1 ? binding.targets[0] : undefined
            if (
                slot.cardinality.min !== 1 ||
                slot.cardinality.max !== 1 ||
                slot.selectorKinds.length !== 1 ||
                slot.selectorKinds[0] !== 'semantic-key' ||
                slot.requirements.entityKinds?.includes('object') !== true ||
                semanticKeyComponents.length !== 1 ||
                !target ||
                target.entityKind !== 'object' ||
                target.selector.kind !== 'semantic-key' ||
                target.selector.field !== semanticKeyComponents[0].field
            ) {
                throw cloneRecordPolicyError(placement.widgetKey, `Slot "${slot.key}" is not a single Object semantic-key source`)
            }

            plans.push({
                widgetId: placement.id,
                widgetKey: placement.widgetKey,
                zone: placement.zone,
                originalConfig: placement.config,
                slot,
                target: target as CloneRecordBindingPlan['target'],
                semanticKeyComponentCodename: semanticKeyComponents[0].componentCodename
            })
        }

        if (bindings.slots.length !== slots.length) {
            throw cloneRecordPolicyError(placement.widgetKey, 'Stored bindings include an unsupported slot')
        }
    }

    return plans
}

/**
 * Copy every server-registered single-record binding in a locked placement subtree.
 * The caller must hold the metahub layout graph lock and run this on that same
 * transaction before inserting any copied placements.
 */
export const cloneRecordWidgetBindingsInSubtree = async (input: {
    readonly executor: DbExecutor
    readonly metahubId: string
    readonly schemaName: string
    readonly templateKey: ApplicationTemplateKey
    readonly placements: readonly CloneRecordPlacement[]
    readonly userId?: string | null
}): Promise<ReadonlyMap<string, Record<string, unknown>>> => {
    const plans = planCloneRecordBindings(input.templateKey, input.placements)
    if (plans.length === 0) return new Map()

    const schemaService = new MetahubSchemaService(input.executor)
    const objectsService = new MetahubObjectsService(input.executor, schemaService)
    const componentsService = new MetahubComponentsService(input.executor, schemaService)
    const recordsService = new MetahubRecordsService(input.executor, schemaService, objectsService, componentsService)
    const componentsByObjectId = new Map<string, Awaited<ReturnType<typeof componentsService.findAllFlat>>>()

    const sourceCodenames = [...new Set(plans.map(({ target }) => target.entityCodename))].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0
    )
    const lockedObjects = new Map<string, Awaited<ReturnType<typeof acquireWidgetBindingObjectLockByCodename>>>()
    for (const codename of sourceCodenames) {
        const object = await acquireWidgetBindingObjectLockByCodename(input.executor, input.schemaName, 'object', codename, true)
        if (object.kind !== 'object' || object.codename !== codename) {
            throw new MetahubNotFoundError('Binding source')
        }
        lockedObjects.set(codename, object)
    }

    const copiedSemanticKeys = new Map<CloneRecordBindingPlan, string>()
    for (const plan of plans) {
        const target = plan.target
        const object = lockedObjects.get(target.entityCodename)
        if (!object) throw cloneRecordPolicyError(plan.widgetKey, 'Locked source Object could not be resolved')

        let components = componentsByObjectId.get(object.id)
        if (!components) {
            components = await componentsService.findAllFlat(
                input.metahubId,
                object.id,
                input.userId ?? undefined,
                'business',
                input.executor
            )
            componentsByObjectId.set(object.id, components)
        }
        const entityComponents = components
            .filter(({ parentComponentId }) => parentComponentId === null)
            .map(({ codename, dataType, isRequired, validationRules, uiConfig }) => ({
                codename,
                dataType,
                isRequired,
                validationRules,
                uiConfig
            }))
        if (
            !isCompatibleWidgetBindingEntity(plan.slot, {
                kind: object.kind,
                codename: object.codename,
                config: object.config,
                components: entityComponents
            })
        ) {
            throw cloneRecordPolicyError(plan.widgetKey, `Source Object no longer satisfies slot "${plan.slot.key}"`)
        }

        const keyComponent = components.find(
            ({ codename, parentComponentId }) => codename === plan.semanticKeyComponentCodename && parentComponentId === null
        )
        if (!keyComponent) {
            throw cloneRecordPolicyError(plan.widgetKey, 'Registry semantic-key Component is missing from the source Object')
        }

        const recordCandidates = await findWidgetRecordCloneCandidatesBySemanticKey(
            input.executor,
            input.schemaName,
            object.id,
            plan.semanticKeyComponentCodename,
            target.selector.value
        )
        if (recordCandidates.length !== 1) {
            throw new MetahubConflictError('The bound source record is missing or ambiguous')
        }

        const source = await recordsService.lockForCopy(
            input.metahubId,
            object.id,
            recordCandidates[0].id,
            input.userId ?? undefined,
            input.executor
        )
        if (!source || source.object.kind !== 'object' || source.object.codename !== target.entityCodename) {
            throw new MetahubNotFoundError('Binding source record')
        }
        if (source.record.data[plan.semanticKeyComponentCodename] !== target.selector.value) {
            throw new MetahubConflictError('Bound source record changed before it could be copied')
        }
        const lockedMatchingRecords = await findWidgetBindingRecordBySemanticKey(
            input.executor,
            input.schemaName,
            object.id,
            plan.semanticKeyComponentCodename,
            target.selector.value
        )
        if (lockedMatchingRecords.length !== 1 || lockedMatchingRecords[0].id !== source.record.id) {
            throw new MetahubConflictError('The bound source record is no longer unique')
        }

        const preparedCopy = await prepareRecordCopy({
            metahubId: input.metahubId,
            objectCollectionId: object.id,
            sourceData: source.record.data,
            components,
            recordsService,
            userId: input.userId ?? undefined,
            db: input.executor
        })
        const copiedRecord = await recordsService.create(
            input.metahubId,
            object.id,
            { data: preparedCopy.data, createdBy: input.userId ?? null },
            input.userId ?? undefined,
            input.executor
        )
        const copiedSemanticKey = copiedRecord.data[plan.semanticKeyComponentCodename]
        if (
            !isUuidV7(copiedRecord.id) ||
            copiedRecord.id === source.record.id ||
            typeof copiedSemanticKey !== 'string' ||
            copiedSemanticKey.length === 0 ||
            copiedSemanticKey === target.selector.value
        ) {
            throw new MetahubValidationError('Copied binding source did not receive a valid UUID v7 identity and distinct semantic key')
        }

        copiedSemanticKeys.set(plan, copiedSemanticKey)
    }

    const copiedConfigs = new Map<string, Record<string, unknown>>()
    for (const [plan, copiedSemanticKey] of copiedSemanticKeys) {
        const currentConfig = copiedConfigs.get(plan.widgetId) ?? plan.originalConfig
        const decoded = decodeWidgetConfigEnvelope(currentConfig, {
            templateKey: input.templateKey,
            widgetKey: plan.widgetKey,
            zone: plan.zone,
            requireBindings: true
        })
        const currentBindings = validateWidgetBindings(
            requireLayoutWidgetOwnership(input.templateKey, plan.widgetKey, currentConfig),
            decoded.neutral.bindings
        )
        const rewrittenBindings = {
            ...currentBindings,
            slots: currentBindings.slots.map((binding) =>
                binding.slot !== plan.slot.key
                    ? binding
                    : {
                          ...binding,
                          targets: binding.targets.map((target) => ({
                              ...target,
                              selector:
                                  target.selector.kind === 'semantic-key'
                                      ? { ...target.selector, value: copiedSemanticKey }
                                      : target.selector
                          }))
                      }
            )
        }

        const validatedBindings = validateWidgetBindings(
            requireLayoutWidgetOwnership(input.templateKey, plan.widgetKey, currentConfig),
            rewrittenBindings
        )
        copiedConfigs.set(
            plan.widgetId,
            encodeWidgetConfigEnvelope(
                { rendererConfig: decoded.rendererConfig, neutral: { ...decoded.neutral, bindings: validatedBindings } },
                { templateKey: input.templateKey, widgetKey: plan.widgetKey, zone: plan.zone }
            )
        )
    }

    return copiedConfigs
}
