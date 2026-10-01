import { z } from 'zod'
import {
    applicationLayoutZoneSchema,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    marketingWidgetKeySchema,
    marketingWidgetRecordCopyIntentSchema,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
import { MetahubRecordsService } from '../../metahubs/services/MetahubRecordsService'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { prepareRecordCopy } from '../../metahubs/services/recordCopy'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import type { DbExecutor } from '../../../utils'
import { acquireMetahubLayoutGraphLock } from '../layoutGraphLocks'
import { MetahubLayoutsService } from './MetahubLayoutsService'

export const marketingWidgetRecordDuplicateRequestSchema = z
    .object({
        zone: applicationLayoutZoneSchema,
        widgetKey: marketingWidgetKeySchema,
        config: z.record(z.string(), z.unknown()),
        expectedVersion: z.number().int().positive(),
        recordCopy: marketingWidgetRecordCopyIntentSchema
    })
    .strict()

type DuplicateRequest = z.infer<typeof marketingWidgetRecordDuplicateRequestSchema>

interface DuplicateBindingContext {
    readonly definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
    readonly slot: WidgetBindingSlotDefinition
    readonly semanticKeyComponentCodename: string
    readonly decoded: ReturnType<typeof decodeWidgetConfigEnvelope>
}

const resolveDuplicateBinding = (input: DuplicateRequest): DuplicateBindingContext => {
    let decoded: ReturnType<typeof decodeWidgetConfigEnvelope>
    try {
        decoded = decodeWidgetConfigEnvelope(input.config, {
            templateKey: 'marketing-page',
            widgetKey: input.widgetKey,
            zone: input.zone,
            requireBindings: true
        })
    } catch (error) {
        throw new MetahubValidationError('Invalid duplicate widget configuration', {
            reason: error instanceof Error ? error.message : 'Invalid widget configuration'
        })
    }

    const definition = getLayoutWidgetDefinition(input.widgetKey, decoded.rendererConfig)
    const authoring = definition?.authoring?.metahub
    if (
        !definition ||
        definition.templateKey !== 'marketing-page' ||
        !definition.supportedTemplates.includes('marketing-page') ||
        authoring?.duplicate !== 'clone-record' ||
        authoring.contentEditing !== 'single-record'
    ) {
        throw new MetahubValidationError('Widget does not support record duplication')
    }

    const slot = definition.bindingSlots?.find(({ key }) => key === input.recordCopy.slot)
    const semanticComponents = slot?.requirements.components.filter(({ semanticKey }) => semanticKey === true) ?? []
    if (
        !slot ||
        slot.cardinality.min !== 1 ||
        slot.cardinality.max !== 1 ||
        !slot.selectorKinds.includes('semantic-key') ||
        slot.requirements.entityKinds?.includes('object') !== true ||
        semanticComponents.length !== 1
    ) {
        throw new MetahubValidationError('Widget slot does not support single-record duplication')
    }

    const bindings = decoded.neutral.bindings
    const binding = bindings?.slots.find(({ slot: slotKey }) => slotKey === slot.key)
    const target = binding?.targets.length === 1 ? binding.targets[0] : undefined
    const semanticKeyComponent = semanticComponents[0]
    if (
        !target ||
        target.entityKind !== 'object' ||
        target.entityCodename !== input.recordCopy.sourceKey ||
        target.selector.kind !== 'semantic-key' ||
        target.selector.field !== semanticKeyComponent.field ||
        target.selector.value !== input.recordCopy.sourceSemanticKey
    ) {
        throw new MetahubValidationError('Widget slot must bind the selected source record before duplication')
    }

    return {
        definition,
        slot,
        semanticKeyComponentCodename: semanticKeyComponent.componentCodename,
        decoded
    }
}

const rewriteCopiedRecordBinding = (
    input: DuplicateRequest,
    context: DuplicateBindingContext,
    copiedSemanticKey: string
): Record<string, unknown> => {
    const bindings = context.decoded.neutral.bindings
    if (!bindings) throw new MetahubValidationError('Widget binding is required for record duplication')

    const rewrittenBindings = {
        ...bindings,
        slots: bindings.slots.map((binding) =>
            binding.slot !== context.slot.key
                ? binding
                : {
                      ...binding,
                      targets: binding.targets.map((target) => ({
                          ...target,
                          selector:
                              target.selector.kind === 'semantic-key' ? { ...target.selector, value: copiedSemanticKey } : target.selector
                      }))
                  }
        )
    }

    try {
        return encodeWidgetConfigEnvelope(
            {
                rendererConfig: context.decoded.rendererConfig,
                neutral: { ...context.decoded.neutral, bindings: rewrittenBindings }
            },
            { templateKey: 'marketing-page', widgetKey: input.widgetKey, zone: input.zone }
        )
    } catch (error) {
        throw new MetahubValidationError('Copied widget configuration is invalid', {
            reason: error instanceof Error ? error.message : 'Invalid widget configuration'
        })
    }
}

/** Copy a registered single-record Marketing source and create its placement in one transaction. */
export const duplicateMarketingWidgetRecordAndPlace = async (input: {
    executor: DbExecutor
    metahubId: string
    layoutId: string
    userId: string
    request: DuplicateRequest
}) => {
    const bindingContext = resolveDuplicateBinding(input.request)

    return withTransactionSavepoint(input.executor, async (tx) => {
        const schemaService = new MetahubSchemaService(tx)
        const schemaName = await schemaService.ensureSchema(input.metahubId, input.userId)

        // Follow the shared graph -> entity -> record lock order before any copy work.
        await acquireMetahubLayoutGraphLock(tx, schemaName)

        const objectsService = new MetahubObjectsService(tx, schemaService)
        const componentsService = new MetahubComponentsService(tx, schemaService)
        const recordsService = new MetahubRecordsService(tx, schemaService, objectsService, componentsService)
        const { recordCopy } = input.request
        const source = await recordsService.lockForCopy(input.metahubId, recordCopy.entityId, recordCopy.recordId, input.userId, tx)
        if (!source) throw new MetahubNotFoundError('Record')
        if (source.object.codename !== recordCopy.sourceKey) throw new MetahubNotFoundError('Binding source')
        if (source.record.data[bindingContext.semanticKeyComponentCodename] !== recordCopy.sourceSemanticKey) {
            throw new MetahubConflictError('Binding source record changed before it could be copied')
        }

        const components = await componentsService.findAllFlat(input.metahubId, recordCopy.entityId, input.userId, 'business', tx)
        const preparedCopy = await prepareRecordCopy({
            metahubId: input.metahubId,
            objectCollectionId: recordCopy.entityId,
            sourceData: source.record.data,
            components,
            recordsService,
            userId: input.userId,
            db: tx
        })
        const copiedRecord = await recordsService.create(
            input.metahubId,
            recordCopy.entityId,
            { data: preparedCopy.data, createdBy: input.userId },
            input.userId,
            tx
        )
        const copiedSemanticKey = copiedRecord.data[bindingContext.semanticKeyComponentCodename]
        if (typeof copiedSemanticKey !== 'string' || copiedSemanticKey.length === 0) {
            throw new MetahubValidationError('Copied record is missing the registered semantic key')
        }
        if (copiedSemanticKey === recordCopy.sourceSemanticKey) {
            throw new MetahubConflictError('Copied record did not receive a distinct semantic key')
        }

        const config = rewriteCopiedRecordBinding(input.request, bindingContext, copiedSemanticKey)
        const layoutsService = new MetahubLayoutsService(tx, schemaService)
        return layoutsService.assignLayoutZoneWidget(
            input.metahubId,
            input.layoutId,
            {
                zone: input.request.zone,
                widgetKey: input.request.widgetKey,
                config,
                expectedVersion: input.request.expectedVersion
            },
            input.userId
        )
    })
}
