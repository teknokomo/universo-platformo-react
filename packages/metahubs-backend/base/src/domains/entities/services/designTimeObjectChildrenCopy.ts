import { qSchemaTable } from '@universo/database'
import type {
    CatalogSystemFieldState,
    CodenameAlphabet,
    CodenameStyle,
    FixedValueDataType,
    PlatformSystemFieldDefinitionsPolicy
} from '@universo/types'
import { queryMany, queryOne, type SqlQueryable } from '@universo/utils/database'
import { MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { getCodenamePayloadText, syncCodenamePayloadText } from '../../shared/codenamePayload'

type SourceAttributeRow = {
    id: string
    codename: unknown
    data_type: string
    presentation?: unknown
    validation_rules?: unknown
    ui_config?: unknown
    sort_order?: number | null
    is_required?: boolean | null
    is_display_attribute?: boolean | null
    target_object_id?: string | null
    target_object_kind?: string | null
    target_constant_id?: string | null
    parent_attribute_id?: string | null
    is_system?: boolean | null
    system_key?: string | null
    is_system_managed?: boolean | null
    is_system_enabled?: boolean | null
}

type SourceElementRow = {
    data?: unknown
    sort_order?: number | null
    owner_id?: string | null
}

type SourceEnumerationValueRow = {
    codename: unknown
    presentation?: unknown
    sort_order?: number | null
    is_default?: boolean | null
}

type SourceConstantRow = {
    codename: unknown
    dataType: FixedValueDataType
    name: unknown
    validationRules?: unknown
    uiConfig?: unknown
    value?: unknown
    sortOrder?: number
}

type EnsureObjectSystemFieldDefinitions = (
    metahubId: string,
    objectId: string,
    userId?: string,
    db?: SqlQueryable,
    options?: {
        states?: CatalogSystemFieldState[]
        policy?: PlatformSystemFieldDefinitionsPolicy
    }
) => Promise<unknown>

type FixedValuesServiceAdapter = {
    findAll: (metahubId: string, objectId: string, userId?: string) => Promise<SourceConstantRow[]>
    ensureUniqueCodenameWithRetries: (options: {
        metahubId: string
        valueGroupId: string
        desiredCodename: string
        codenameStyle: CodenameStyle
        userId?: string
        db: SqlQueryable
    }) => Promise<string>
    create: (
        metahubId: string,
        data: {
            valueGroupId: string
            codename: unknown
            dataType: FixedValueDataType
            name: unknown
            validationRules?: Record<string, unknown>
            uiConfig?: Record<string, unknown>
            value?: unknown
            sortOrder?: number
            createdBy?: string | null
        },
        userId?: string,
        db?: SqlQueryable
    ) => Promise<unknown>
}

export type CopyDesignTimeObjectChildrenOptions = {
    metahubId: string
    sourceObjectId: string
    targetObjectId: string
    tx: SqlQueryable
    userId?: string
    schemaName?: string
    copyFieldDefinitions?: boolean
    copyRecords?: boolean
    copyFixedValues?: boolean
    copyOptionValues?: boolean
    codenameStyle?: CodenameStyle
    codenameAlphabet?: CodenameAlphabet
    fieldDefinitionCopyFailureMessage?: string
    ensureObjectSystemFieldDefinitions?: EnsureObjectSystemFieldDefinitions
    platformSystemFieldDefinitionsPolicy?: PlatformSystemFieldDefinitionsPolicy
    fixedValuesService?: FixedValuesServiceAdapter
}

export type CopyDesignTimeObjectChildrenResult = {
    fieldDefinitionsCopied: number
    recordsCopied: number
    fixedValuesCopied: number
    optionValuesCopied: number
}

const getSchemaNameOrThrow = (schemaName: string | undefined, capability: string) => {
    if (!schemaName) {
        throw new MetahubValidationError(`${capability} requires a resolved metahub schema`)
    }
    return schemaName
}

const getFixedValuesAdapterOrThrow = (fixedValuesService: FixedValuesServiceAdapter | undefined) => {
    if (!fixedValuesService) {
        throw new MetahubValidationError('Fixed value copy requires the fixed-values service adapter')
    }
    return fixedValuesService
}

const getCodenameSettingsOrThrow = (codenameStyle: CodenameStyle | undefined, codenameAlphabet: CodenameAlphabet | undefined) => {
    if (!codenameStyle || !codenameAlphabet) {
        throw new MetahubValidationError('Fixed value copy requires codename style settings')
    }

    return { codenameStyle, codenameAlphabet }
}

const asRecordOrUndefined = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

export async function copyDesignTimeObjectChildren(
    options: CopyDesignTimeObjectChildrenOptions
): Promise<CopyDesignTimeObjectChildrenResult> {
    const {
        metahubId,
        sourceObjectId,
        targetObjectId,
        tx,
        userId,
        schemaName,
        copyFieldDefinitions = false,
        copyRecords = false,
        copyFixedValues = false,
        copyOptionValues = false,
        codenameStyle,
        codenameAlphabet,
        fieldDefinitionCopyFailureMessage = 'Failed to copy object field definitions hierarchy',
        ensureObjectSystemFieldDefinitions,
        platformSystemFieldDefinitionsPolicy,
        fixedValuesService
    } = options

    const result: CopyDesignTimeObjectChildrenResult = {
        fieldDefinitionsCopied: 0,
        recordsCopied: 0,
        fixedValuesCopied: 0,
        optionValuesCopied: 0
    }

    const needsAttributeTable = copyFieldDefinitions || copyRecords || copyOptionValues || Boolean(ensureObjectSystemFieldDefinitions)
    const resolvedSchemaName = needsAttributeTable ? getSchemaNameOrThrow(schemaName, 'Design-time child copy') : schemaName
    const attrQt = resolvedSchemaName ? qSchemaTable(resolvedSchemaName, '_mhb_attributes') : null
    const elemQt = resolvedSchemaName ? qSchemaTable(resolvedSchemaName, '_mhb_elements') : null
    const valuesQt = resolvedSchemaName ? qSchemaTable(resolvedSchemaName, '_mhb_values') : null

    if (copyFieldDefinitions && attrQt) {
        const sourceAttributes = await queryMany<SourceAttributeRow>(
            tx,
            `SELECT * FROM ${attrQt}
             WHERE object_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [sourceObjectId]
        )

        const attributeIdMap = new Map<string, string>()
        const pendingAttributes = [...sourceAttributes]

        while (pendingAttributes.length > 0) {
            let progressed = false

            for (let index = 0; index < pendingAttributes.length; index += 1) {
                const sourceAttr = pendingAttributes[index]
                const sourceParentId = sourceAttr.parent_attribute_id ?? null

                if (sourceParentId && !attributeIdMap.has(sourceParentId)) {
                    continue
                }

                const targetAttributeObjectId =
                    sourceAttr.target_object_id && sourceAttr.target_object_id === sourceObjectId
                        ? targetObjectId
                        : sourceAttr.target_object_id ?? null

                const createdAttr = await queryOne<{ id: string }>(
                    tx,
                    `INSERT INTO ${attrQt}
                     (object_id, codename, data_type, presentation, validation_rules, ui_config,
                      sort_order, is_required, is_display_attribute, target_object_id, target_object_kind,
                      target_constant_id, parent_attribute_id, is_system, system_key, is_system_managed,
                      is_system_enabled, _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), $18, NOW(), $18)
                     RETURNING id`,
                    [
                        targetObjectId,
                        sourceAttr.codename,
                        sourceAttr.data_type,
                        JSON.stringify(sourceAttr.presentation ?? {}),
                        JSON.stringify(sourceAttr.validation_rules ?? {}),
                        JSON.stringify(sourceAttr.ui_config ?? {}),
                        sourceAttr.sort_order ?? 0,
                        sourceAttr.is_required ?? false,
                        sourceAttr.is_display_attribute ?? false,
                        targetAttributeObjectId,
                        sourceAttr.target_object_kind ?? null,
                        sourceAttr.target_constant_id ?? null,
                        sourceParentId ? attributeIdMap.get(sourceParentId) ?? null : null,
                        sourceAttr.is_system ?? false,
                        sourceAttr.system_key ?? null,
                        sourceAttr.is_system_managed ?? false,
                        sourceAttr.is_system_enabled ?? true,
                        userId ?? null
                    ]
                )

                if (!createdAttr?.id) {
                    throw new MetahubDomainError({
                        message: fieldDefinitionCopyFailureMessage,
                        statusCode: 500,
                        code: 'COPY_ATTRIBUTES_FAILED'
                    })
                }

                attributeIdMap.set(sourceAttr.id, createdAttr.id)
                pendingAttributes.splice(index, 1)
                index -= 1
                result.fieldDefinitionsCopied += 1
                progressed = true
            }

            if (!progressed) {
                throw new MetahubDomainError({
                    message: fieldDefinitionCopyFailureMessage,
                    statusCode: 500,
                    code: 'COPY_ATTRIBUTES_FAILED'
                })
            }
        }
    }

    let sourceSystemStates: CatalogSystemFieldState[] | undefined
    if (!copyFieldDefinitions && ensureObjectSystemFieldDefinitions && attrQt) {
        const sourceSystemRows = await queryMany<Pick<SourceAttributeRow, 'system_key' | 'is_system_enabled'>>(
            tx,
            `SELECT system_key, is_system_enabled
             FROM ${attrQt}
             WHERE object_id = $1
               AND is_system = true
               AND _upl_deleted = false
               AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [sourceObjectId]
        )

        sourceSystemStates = sourceSystemRows.flatMap((row) =>
            typeof row.system_key === 'string'
                ? [
                      {
                          key: row.system_key as CatalogSystemFieldState['key'],
                          enabled: row.is_system_enabled !== false
                      }
                  ]
                : []
        )
    }

    if (copyRecords && elemQt) {
        const sourceElements = await queryMany<SourceElementRow>(
            tx,
            `SELECT * FROM ${elemQt}
             WHERE object_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [sourceObjectId]
        )

        if (sourceElements.length > 0) {
            const placeholders: string[] = []
            const params: unknown[] = []
            let idx = 1

            for (const element of sourceElements) {
                placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, NOW(), $${idx + 4}, NOW(), $${idx + 4})`)
                params.push(
                    targetObjectId,
                    JSON.stringify(element.data ?? {}),
                    element.sort_order ?? 0,
                    element.owner_id ?? null,
                    userId ?? null
                )
                idx += 5
            }

            const insertedRows = await tx.query(
                `INSERT INTO ${elemQt}
                 (object_id, data, sort_order, owner_id, _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ${placeholders.join(', ')}
                 RETURNING id`,
                params
            )

            result.recordsCopied = insertedRows.length
        }
    }

    if (copyFixedValues) {
        const fixedValuesAdapter = getFixedValuesAdapterOrThrow(fixedValuesService)
        const codenameSettings = getCodenameSettingsOrThrow(codenameStyle, codenameAlphabet)
        const sourceConstants = await fixedValuesAdapter.findAll(metahubId, sourceObjectId, userId)

        for (const sourceConstant of sourceConstants) {
            const sourceConstantCodename = getCodenamePayloadText(sourceConstant.codename as Parameters<typeof getCodenamePayloadText>[0])
            if (!sourceConstantCodename) {
                throw new MetahubValidationError('Source fixed value codename is missing')
            }

            const constantCodename = await fixedValuesAdapter.ensureUniqueCodenameWithRetries({
                metahubId,
                valueGroupId: targetObjectId,
                desiredCodename: sourceConstantCodename,
                codenameStyle: codenameSettings.codenameStyle,
                userId,
                db: tx
            })

            const constantCodenamePayload = syncCodenamePayloadText(
                sourceConstant.codename,
                'en',
                constantCodename,
                codenameSettings.codenameStyle,
                codenameSettings.codenameAlphabet
            )

            await fixedValuesAdapter.create(
                metahubId,
                {
                    valueGroupId: targetObjectId,
                    codename: constantCodenamePayload ?? constantCodename,
                    dataType: sourceConstant.dataType,
                    name: sourceConstant.name,
                    validationRules: asRecordOrUndefined(sourceConstant.validationRules),
                    uiConfig: asRecordOrUndefined(sourceConstant.uiConfig),
                    value: sourceConstant.value,
                    sortOrder: sourceConstant.sortOrder,
                    createdBy: userId
                },
                userId,
                tx
            )

            result.fixedValuesCopied += 1
        }
    }

    if (copyOptionValues && valuesQt) {
        const sourceValues = await queryMany<SourceEnumerationValueRow>(
            tx,
            `SELECT codename, presentation, sort_order, is_default
             FROM ${valuesQt}
             WHERE object_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [sourceObjectId]
        )

        if (sourceValues.length > 0) {
            const placeholders: string[] = []
            const params: unknown[] = []
            let idx = 1

            for (const value of sourceValues) {
                placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, NOW(), $${idx + 5}, NOW(), $${idx + 5})`)
                params.push(
                    targetObjectId,
                    value.codename,
                    JSON.stringify(value.presentation ?? {}),
                    value.sort_order ?? 0,
                    value.is_default ?? false,
                    userId ?? null
                )
                idx += 6
            }

            const insertedRows = await tx.query(
                `INSERT INTO ${valuesQt}
                 (object_id, codename, presentation, sort_order, is_default,
                  _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by)
                 VALUES ${placeholders.join(', ')}
                 RETURNING id`,
                params
            )

            result.optionValuesCopied = insertedRows.length
        }
    }

    if (ensureObjectSystemFieldDefinitions) {
        await ensureObjectSystemFieldDefinitions(metahubId, targetObjectId, userId, tx, {
            states: sourceSystemStates,
            policy: platformSystemFieldDefinitionsPolicy
        })
    }

    return result
}
