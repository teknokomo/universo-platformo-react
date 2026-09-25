import {
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_HERO_ENTITY_CODENAME,
    resolveEntityRecordPolicy,
    buildSingleTargetWidgetBinding,
    matchesWidgetBindingComponentValidationRules,
    marketingHeroEntityContentSchema,
    widgetEntityBindingEnvelopeSchema,
    type EntityRecordPolicy,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { toLocalizedStringMap } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import { codenamePrimaryTextSql } from '../shared/codename'
import { MetahubNotFoundError, MetahubValidationError } from '../shared/domainErrors'
import { acquireWidgetBindingObjectLockByCodename } from './widgetBindingPolicyStore'
import { acquireWidgetBindingObjectLock } from './widgetBindingPolicyStore'
import { isAuthoritativeMarketingHeroRecordPolicy, validateEntityRecordPolicyData } from '../shared/entityRecordPolicy'

export const MARKETING_HERO_OBJECT = MARKETING_HERO_ENTITY_CODENAME
const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

type DbComponent = {
    codename: string
    data_type: string
    is_required: boolean
    validation_rules: unknown
}

export type MarketingHeroBindingTarget = {
    binding: WidgetEntityBindingEnvelope
    recordId: string
    recordVersion: number
    label: string
    data: ReturnType<typeof marketingHeroEntityContentSchema.parse>
    policy: EntityRecordPolicy
    entityId: string
    entityCodename: string
    rawData: Record<string, unknown>
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const validateMarketingHeroComponents = (components: readonly DbComponent[]): void => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
    const slot = definition?.bindingSlots?.find((entry) => entry.key === 'content')
    if (!definition || !slot) throw new MetahubValidationError('Hero binding slot is not registered')

    for (const requirement of slot.requirements.components) {
        const component = components.find(({ codename }) => codename === requirement.componentCodename)
        const expectedDataType = requirement.valueType.toUpperCase()
        if (
            !component ||
            component.data_type !== expectedDataType ||
            component.is_required !== requirement.required ||
            !matchesWidgetBindingComponentValidationRules(requirement, component.validation_rules)
        ) {
            throw new MetahubValidationError('Hero Entity Components do not match the registered binding slot', {
                field: requirement.field
            })
        }
    }
}

type LockedHeroObject = Awaited<ReturnType<typeof acquireWidgetBindingObjectLockByCodename>>
type HeroBindingRecord = { id: string; data: unknown; version: number }
type ValidatedLockedHeroObject = {
    object: LockedHeroObject
    policy: EntityRecordPolicy
    semanticKeyDefinition: NonNullable<EntityRecordPolicy['semanticKey']>
    components: DbComponent[]
}

/** Project the registered Hero Entity components into the bounded renderer DTO. */
export const projectMarketingHeroContentData = (rawData: unknown): ReturnType<typeof marketingHeroEntityContentSchema.parse> => {
    const data = asRecord(rawData)
    const definition = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
    const slot = definition?.bindingSlots?.find((entry) => entry.key === 'content')
    if (!definition || !slot) throw new MetahubValidationError('Hero widget definition is not registered')

    const contentProjection = slot.requirements.components.reduce<Record<string, unknown>>((projected, requirement) => {
        if (requirement.semanticKey) return projected
        const value = requirement.localized
            ? toLocalizedStringMap(data[requirement.componentCodename])
            : data[requirement.componentCodename]
        if (value !== undefined && (requirement.required || value !== null)) projected[requirement.field] = value
        return projected
    }, {})
    return marketingHeroEntityContentSchema.parse(contentProjection)
}

const findAndLockMarketingHeroObject = async (
    db: SqlQueryable,
    schemaName: string,
    entityCodename: string,
    layoutGraphLockAlreadyHeld = false
): Promise<LockedHeroObject> =>
    acquireWidgetBindingObjectLockByCodename(db, schemaName, 'object', entityCodename, layoutGraphLockAlreadyHeld)

export const validateLockedMarketingHeroObject = async (
    db: SqlQueryable,
    schemaName: string,
    object: LockedHeroObject
): Promise<ValidatedLockedHeroObject> => {
    if (object.kind !== 'object') {
        throw new MetahubValidationError('Hero binding target must be an Object')
    }
    const policy = resolveEntityRecordPolicy(object.config)
    if (!isAuthoritativeMarketingHeroRecordPolicy(policy)) {
        throw new MetahubValidationError('Hero Entity record policy is invalid')
    }
    const semanticKeyDefinition = policy.semanticKey
    if (!semanticKeyDefinition) throw new MetahubValidationError('Hero Entity record policy has no semantic key')

    const components = await queryMany<DbComponent>(
        db,
        `SELECT ${codenamePrimaryTextSql('codename')} AS codename,
                data_type, is_required, validation_rules
           FROM ${qSchemaTable(schemaName, '_mhb_components')}
          WHERE object_id = $1
            AND parent_component_id IS NULL
            AND ${ACTIVE}`,
        [object.id]
    )
    const registeredSemanticKey = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
        ?.bindingSlots?.find((entry) => entry.key === 'content')
        ?.requirements.components.find(({ semanticKey }) => semanticKey)?.componentCodename
    if (semanticKeyDefinition.componentCodename !== registeredSemanticKey) {
        throw new MetahubValidationError('Hero Entity semantic key does not match the registered binding slot')
    }
    validateMarketingHeroComponents(components)
    return { object, policy, semanticKeyDefinition, components }
}

const resolveLockedMarketingHeroBindingTarget = async (
    db: SqlQueryable,
    schemaName: string,
    validatedObject: ValidatedLockedHeroObject,
    record: HeroBindingRecord,
    locale: string,
    options: { expectedSemanticKey?: string; semanticKeyAlreadyUnique?: boolean } = {}
): Promise<MarketingHeroBindingTarget> => {
    const { object, policy, semanticKeyDefinition, components } = validatedObject

    const data = asRecord(record.data)
    const semanticKey = data[semanticKeyDefinition.componentCodename]
    if (
        typeof semanticKey !== 'string' ||
        semanticKey.length === 0 ||
        (options.expectedSemanticKey !== undefined && semanticKey !== options.expectedSemanticKey)
    ) {
        throw new MetahubValidationError('Hero content record has an invalid semantic key')
    }

    if (!options.semanticKeyAlreadyUnique) {
        const matchingRows = await queryMany<{ id: string }>(
            db,
            `SELECT id
               FROM ${qSchemaTable(schemaName, '_mhb_elements')}
              WHERE object_id = $1
                AND ${ACTIVE}
                AND data ->> $2::text = $3
              ORDER BY id ASC
              LIMIT 2
              FOR SHARE`,
            [object.id, semanticKeyDefinition.componentCodename, semanticKey]
        )
        if (matchingRows.length !== 1 || matchingRows[0]?.id !== record.id) {
            throw new MetahubValidationError('Hero semantic key does not resolve to one active Entity record')
        }
    }

    const validation = validateEntityRecordPolicyData(
        policy,
        data,
        components.map((component) => ({
            codename: component.codename,
            isRequired: component.is_required,
            validationRules: asRecord(component.validation_rules)
        }))
    )
    if (!validation.valid) throw new MetahubValidationError('Hero content is incomplete or invalid', { fields: validation.errors })

    const definition = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
    if (!definition) throw new MetahubValidationError('Hero widget definition is not registered')
    const resolvedContent = projectMarketingHeroContentData(data)
    const binding = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: object.codename,
        semanticKey
    })
    const label = resolvedContent.title[locale] ?? resolvedContent.title.en ?? Object.values(resolvedContent.title)[0] ?? ''
    if (!label) throw new MetahubValidationError('Hero content title is missing')

    return {
        binding,
        recordId: record.id,
        recordVersion: record.version,
        label,
        data: resolvedContent,
        policy,
        entityId: object.id,
        entityCodename: object.codename,
        rawData: data
    }
}

/** Resolve and validate one server-owned Hero Entity record binding. */
export const loadMarketingHeroBindingTarget = async (
    db: SqlQueryable,
    schemaName: string,
    recordId: string,
    locale: string
): Promise<MarketingHeroBindingTarget> => {
    const recordOwner = await queryOne<{ object_id: string }>(
        db,
        `SELECT object_id FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = $1 AND ${ACTIVE} LIMIT 1`,
        [recordId]
    )
    if (!recordOwner) throw new MetahubNotFoundError('Hero content record')
    const object = await acquireWidgetBindingObjectLock(db, schemaName, recordOwner.object_id)
    const validatedObject = await validateLockedMarketingHeroObject(db, schemaName, object)
    const record = await queryOne<HeroBindingRecord>(
        db,
        `SELECT id, data, COALESCE(_upl_version, 1)::int AS version
           FROM ${qSchemaTable(schemaName, '_mhb_elements')}
          WHERE id = $1
            AND object_id = $2
            AND ${ACTIVE}
          LIMIT 1
          FOR SHARE`,
        [recordId, object.id]
    )
    if (!record) throw new MetahubNotFoundError('Hero content record')
    return resolveLockedMarketingHeroBindingTarget(db, schemaName, validatedObject, record, locale)
}

/** Resolve an editor-only binding back to its current record without persisting physical IDs. */
export const loadMarketingHeroBindingBySemanticTarget = async (
    db: SqlQueryable,
    schemaName: string,
    rawBinding: WidgetEntityBindingEnvelope,
    locale: string,
    options: { layoutGraphLockAlreadyHeld?: boolean } = {}
): Promise<MarketingHeroBindingTarget> => {
    const binding = widgetEntityBindingEnvelopeSchema.parse(rawBinding)
    const target = binding.slots.find(({ slot }) => slot === 'content')?.targets[0]
    if (
        !target ||
        target.entityKind !== 'object' ||
        typeof target.entityCodename !== 'string' ||
        target.entityCodename.length === 0 ||
        target.selector.kind !== 'semantic-key' ||
        target.projection.length === 0
    ) {
        throw new MetahubValidationError('Hero binding metadata is invalid')
    }

    const definition = LAYOUT_WIDGET_DEFINITIONS.find((entry) => entry.key === 'marketing.hero')
    const slot = definition?.bindingSlots?.find((entry) => entry.key === 'content')
    const semanticKeyComponent = slot?.requirements.components.find((component) => component.semanticKey === true)
    if (!definition || !semanticKeyComponent || semanticKeyComponent.field !== target.selector.field) {
        throw new MetahubValidationError('Hero binding selector does not match the registry')
    }

    const object = await findAndLockMarketingHeroObject(db, schemaName, target.entityCodename, options.layoutGraphLockAlreadyHeld)
    const validatedObject = await validateLockedMarketingHeroObject(db, schemaName, object)
    if (validatedObject.semanticKeyDefinition.componentCodename !== semanticKeyComponent.componentCodename) {
        throw new MetahubValidationError('Hero binding target does not match the authoritative Entity policy')
    }
    const rows = await queryMany<HeroBindingRecord>(
        db,
        `SELECT id, data, COALESCE(_upl_version, 1)::int AS version
           FROM ${qSchemaTable(schemaName, '_mhb_elements')}
          WHERE object_id = $1
            AND ${ACTIVE}
            AND data ->> $2::text = $3
          ORDER BY id ASC
          LIMIT 2
          FOR SHARE`,
        [object.id, semanticKeyComponent.componentCodename, target.selector.value]
    )
    if (rows.length !== 1) throw new MetahubNotFoundError('Bound Hero content record')
    return resolveLockedMarketingHeroBindingTarget(db, schemaName, validatedObject, rows[0], locale, {
        expectedSemanticKey: target.selector.value,
        semanticKeyAlreadyUnique: true
    })
}
