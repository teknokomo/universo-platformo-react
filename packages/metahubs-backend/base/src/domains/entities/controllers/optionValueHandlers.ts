import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import {
    CODENAME_RETRY_MAX_ATTEMPTS,
    buildCodenameAttempt,
    codenameErrorMessage,
    getCodenameSettings
} from '../../shared/codenameStyleHelper'
import { getCodenamePayloadText, syncCodenamePayloadText } from '../../shared/codenamePayload'
import { isValidCodenameForStyle, normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import {
    buildDefaultCopyNameInput,
    copyOptionValueSchema,
    createOptionValueSchema,
    extractUniqueViolationError,
    findBlockingDefaultValueReferences,
    findBlockingRecordValueReferences,
    getOptionListCodenameText,
    isOptionListContextKind,
    listValuesQuerySchema,
    loadCompatibleOptionListKinds,
    loadCompatibleOptionListKindSet,
    moveOptionValueSchema,
    reorderValueSchema,
    resolvePrimaryLocale,
    respondUniqueViolation,
    updateOptionValueSchema
} from '../children/optionListHelpers'
import { createEntityMetadataKindSet } from '../../shared/entityMetadataKinds'
import { createOptionListRouteServices, buildLocalizedContent, sanitizeLocalizedInput } from './entityControllerShared'

export function createOptionValueHandlers(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const listOptionValues = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
        const compatibleKinds = await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId)
        const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
        const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
        if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
            return res.status(404).json({ error: 'Enumeration not found' })
        }

        const parsed = listValuesQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }

        const items = parsed.data.includeShared
            ? await valuesService.findAllMerged(metahubId, req.params.optionListId, userId)
            : await valuesService.findAll(metahubId, req.params.optionListId, userId)
        return res.json({ items, total: items.length, meta: { includeShared: parsed.data.includeShared } })
    })

    const getOptionValueById = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
        const compatibleKinds = await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId)
        const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
        const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
        if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
            return res.status(404).json({ error: 'Enumeration not found' })
        }

        const value = await valuesService.findById(metahubId, req.params.valueId, userId)
        if (!value || value.objectId !== req.params.optionListId) {
            return res.status(404).json({ error: 'Option value not found' })
        }

        return res.json(value)
    })

    const getOptionValueBlockingReferences = createHandler(async ({ req, res, metahubId, userId, exec, schemaService }) => {
        const { objectsService, valuesService, fieldDefinitionsService, entityTypeService } = createOptionListRouteServices(
            exec,
            schemaService
        )
        const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
        const compatibleKinds = Array.from(compatibleKindSet)
        const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
        if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
            return res.status(404).json({ error: 'Enumeration not found' })
        }

        const value = await valuesService.findById(metahubId, req.params.valueId, userId)
        if (!value || value.objectId !== req.params.optionListId) {
            return res.status(404).json({ error: 'Option value not found' })
        }

        const [blockingDefaults, blockingElements] = await Promise.all([
            findBlockingDefaultValueReferences(metahubId, req.params.valueId, compatibleKinds, fieldDefinitionsService, userId),
            findBlockingRecordValueReferences(
                metahubId,
                req.params.optionListId,
                req.params.valueId,
                compatibleKinds,
                fieldDefinitionsService,
                userId
            )
        ])

        return res.json({
            valueId: req.params.valueId,
            canDelete: blockingDefaults.length === 0 && blockingElements.length === 0,
            blockingDefaults,
            blockingElements
        })
    })

    const createOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, settingsService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const compatibleKinds = await loadCompatibleOptionListKinds(entityTypeService, metahubId, userId)
            const compatibleKindSet = createEntityMetadataKindSet(compatibleKinds)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = createOptionValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, presentation, sortOrder, namePrimaryLocale, descriptionPrimaryLocale, isDefault } =
                parsed.data
            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const existing = await valuesService.findByCodename(metahubId, req.params.optionListId, normalizedCodename, userId)
            if (existing) {
                return res.status(409).json({ error: 'Option value with this codename already exists' })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const codenamePayload = syncCodenamePayloadText(
                codename,
                namePrimaryLocale ?? 'en',
                normalizedCodename,
                codenameStyle,
                codenameAlphabet
            )
            if (!codenamePayload) {
                return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
            }

            let created
            try {
                created = await valuesService.create(
                    metahubId,
                    {
                        optionListId: req.params.optionListId,
                        codename: codenamePayload,
                        name: nameVlc,
                        description: descriptionVlc,
                        presentation,
                        sortOrder,
                        isDefault,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Option value with this codename already exists')) {
                    return
                }
                throw error
            }

            return res.status(201).json(created)
        },
        { permission: 'editContent' }
    )

    const updateOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, settingsService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const currentValue = await valuesService.findById(metahubId, req.params.valueId, userId)
            if (!currentValue || currentValue.objectId !== req.params.optionListId) {
                return res.status(404).json({ error: 'Option value not found' })
            }

            const parsed = updateOptionValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const {
                codename,
                name,
                description,
                presentation,
                sortOrder,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                isDefault,
                expectedVersion
            } = parsed.data
            const patch: Record<string, unknown> = { updatedBy: userId, expectedVersion }

            if (codename !== undefined) {
                const {
                    style: codenameStyle,
                    alphabet: codenameAlphabet,
                    allowMixed
                } = await getCodenameSettings(settingsService, metahubId, userId)
                const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }
                if (normalizedCodename !== getOptionListCodenameText(currentValue.codename)) {
                    const existing = await valuesService.findByCodename(metahubId, req.params.optionListId, normalizedCodename, userId)
                    if (existing && existing.id !== req.params.valueId) {
                        return res.status(409).json({ error: 'Option value with this codename already exists' })
                    }
                }
                patch.codename =
                    syncCodenamePayloadText(
                        codename,
                        resolvePrimaryLocale(currentValue.codename) ?? namePrimaryLocale ?? 'en',
                        normalizedCodename,
                        codenameStyle,
                        codenameAlphabet
                    ) ?? normalizedCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const primary = namePrimaryLocale ?? resolvePrimaryLocale(currentValue.name) ?? 'en'
                patch.name = buildLocalizedContent(sanitizedName, primary, primary)
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary = descriptionPrimaryLocale ?? resolvePrimaryLocale(currentValue.description) ?? 'en'
                    patch.description = buildLocalizedContent(sanitizedDescription, primary, primary)
                } else {
                    patch.description = null
                }
            }

            if (presentation !== undefined) patch.presentation = presentation
            if (sortOrder !== undefined) patch.sortOrder = sortOrder
            if (isDefault !== undefined) patch.isDefault = isDefault

            let updated
            try {
                updated = await valuesService.update(metahubId, req.params.valueId, patch, userId)
            } catch (error) {
                if (respondUniqueViolation(res, error, 'Option value with this codename already exists')) {
                    return
                }
                throw error
            }

            return res.json(updated)
        },
        { permission: 'editContent' }
    )

    const moveOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = moveOptionValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = await valuesService.moveValue(
                    metahubId,
                    req.params.optionListId,
                    req.params.valueId,
                    parsed.data.direction,
                    userId
                )
                return res.json(updated)
            } catch (error) {
                if (error instanceof Error && error.message === 'Option value not found') {
                    return res.status(404).json({ error: 'Option value not found' })
                }
                throw error
            }
        },
        { permission: 'editContent' }
    )

    const reorderOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const parsed = reorderValueSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            try {
                const updated = parsed.data.mergedOrderIds
                    ? await valuesService.reorderValueMergedOrder(
                          metahubId,
                          req.params.optionListId,
                          parsed.data.valueId,
                          parsed.data.mergedOrderIds,
                          userId
                      )
                    : await valuesService.reorderValue(
                          metahubId,
                          req.params.optionListId,
                          parsed.data.valueId,
                          parsed.data.newSortOrder,
                          userId
                      )
                return res.json(updated)
            } catch (error) {
                if (error instanceof Error && error.message === 'Option value not found') {
                    return res.status(404).json({ error: 'Option value not found' })
                }
                throw error
            }
        },
        { permission: 'editContent' }
    )

    const copyOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, settingsService, entityTypeService } = createOptionListRouteServices(exec, schemaService)
            const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const sourceValue = await valuesService.findById(metahubId, req.params.valueId, userId)
            if (!sourceValue || sourceValue.objectId !== req.params.optionListId) {
                return res.status(404).json({ error: 'Option value not found' })
            }

            const parsed = copyOptionValueSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const sanitizedCustomName = parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name) : null
            if (sanitizedCustomName && Object.keys(sanitizedCustomName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const copyNameInput = sanitizedCustomName ?? buildDefaultCopyNameInput(sourceValue.name)
            const copyNamePrimaryLocale = parsed.data.namePrimaryLocale ?? resolvePrimaryLocale(sourceValue.name) ?? 'en'
            const copyName = buildLocalizedContent(copyNameInput, copyNamePrimaryLocale, 'en')
            if (!copyName) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let copyDescription: unknown = sourceValue.description ?? null
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const descriptionPrimaryLocale =
                        parsed.data.descriptionPrimaryLocale ??
                        resolvePrimaryLocale(sourceValue.description) ??
                        resolvePrimaryLocale(copyName) ??
                        copyNamePrimaryLocale
                    copyDescription =
                        buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, descriptionPrimaryLocale) ?? null
                } else {
                    copyDescription = null
                }
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const requestedCodename =
                parsed.data.codename !== undefined && parsed.data.codename !== null
                    ? normalizeCodenameForStyle(getCodenamePayloadText(parsed.data.codename), codenameStyle, codenameAlphabet)
                    : null
            if (requestedCodename !== null) {
                if (!requestedCodename || !isValidCodenameForStyle(requestedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }
                const existingRequested = await valuesService.findByCodename(metahubId, req.params.optionListId, requestedCodename, userId)
                if (existingRequested) {
                    return res.status(409).json({ error: 'Option value with this codename already exists' })
                }
            }

            const copySuffix = codenameStyle === 'pascal-case' ? 'Copy' : '-copy'
            const baseCodename =
                requestedCodename ?? normalizeCodenameForStyle(`${sourceValue.codename}${copySuffix}`, codenameStyle, codenameAlphabet)
            if (!baseCodename || !isValidCodenameForStyle(baseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({ error: 'Failed to generate codename for optionList value copy' })
            }

            let copiedValue: Awaited<ReturnType<typeof valuesService.create>> | null = null
            const maxAttempts = requestedCodename ? 1 : CODENAME_RETRY_MAX_ATTEMPTS
            const copyCodenameFallbackPrimaryLocale = parsed.data.namePrimaryLocale ?? resolvePrimaryLocale(sourceValue.name) ?? 'en'
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const codenameAttempt = requestedCodename ? baseCodename : buildCodenameAttempt(baseCodename, attempt, codenameStyle)
                const existing = await valuesService.findByCodename(metahubId, req.params.optionListId, codenameAttempt, userId)
                if (existing) {
                    continue
                }

                try {
                    copiedValue = await valuesService.create(
                        metahubId,
                        {
                            optionListId: req.params.optionListId,
                            codename:
                                syncCodenamePayloadText(
                                    parsed.data.codename ?? sourceValue.codename,
                                    copyCodenameFallbackPrimaryLocale,
                                    codenameAttempt,
                                    codenameStyle,
                                    codenameAlphabet
                                ) ?? codenameAttempt,
                            name: copyName,
                            description: copyDescription,
                            sortOrder: (sourceValue.sortOrder ?? 0) + 1,
                            presentation: parsed.data.presentation,
                            isDefault: parsed.data.isDefault === true,
                            createdBy: userId
                        },
                        userId
                    )
                    break
                } catch (error) {
                    if (extractUniqueViolationError(error)) {
                        continue
                    }
                    throw error
                }
            }

            if (!copiedValue) {
                return res.status(409).json({ error: 'Unable to generate unique codename for optionList value copy' })
            }

            return res.status(201).json(copiedValue)
        },
        { permission: 'editContent' }
    )

    const deleteOptionValue = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const { objectsService, valuesService, fieldDefinitionsService, entityTypeService } = createOptionListRouteServices(
                exec,
                schemaService
            )
            const compatibleKindSet = await loadCompatibleOptionListKindSet(entityTypeService, metahubId, userId)
            const compatibleKinds = Array.from(compatibleKindSet)
            const optionList = await objectsService.findById(metahubId, req.params.optionListId, userId)
            if (!optionList || !isOptionListContextKind(optionList.kind, compatibleKindSet)) {
                return res.status(404).json({ error: 'Enumeration not found' })
            }

            const value = await valuesService.findById(metahubId, req.params.valueId, userId)
            if (!value || value.objectId !== req.params.optionListId) {
                return res.status(404).json({ error: 'Option value not found' })
            }

            const blockingDefaults = await findBlockingDefaultValueReferences(
                metahubId,
                req.params.valueId,
                compatibleKinds,
                fieldDefinitionsService,
                userId
            )
            if (blockingDefaults.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete optionList value: it is configured as default in attributes',
                    blockingDefaults
                })
            }

            const blockingElements = await findBlockingRecordValueReferences(
                metahubId,
                req.params.optionListId,
                req.params.valueId,
                compatibleKinds,
                fieldDefinitionsService,
                userId
            )
            if (blockingElements.length > 0) {
                return res.status(409).json({
                    error: 'Cannot delete optionList value: it is used in predefined elements',
                    blockingElements
                })
            }

            await valuesService.delete(metahubId, req.params.valueId, userId)
            return res.status(204).send()
        },
        { permission: 'deleteContent' }
    )

    return {
        listOptionValues,
        getOptionValueById,
        getOptionValueBlockingReferences,
        createOptionValue,
        updateOptionValue,
        moveOptionValue,
        reorderOptionValue,
        copyOptionValue,
        deleteOptionValue
    }
}
