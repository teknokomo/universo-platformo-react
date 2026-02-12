import type { Knex } from 'knex'
import stableStringify from 'json-stable-stringify'
import type { MetahubTemplateSeed, TemplateSeedEntity, TemplateSeedSetting, TemplateSeedElement } from '@universo/types'

export const TEMPLATE_CLEANUP_MODES = ['keep', 'dry_run', 'confirm'] as const
export type TemplateCleanupMode = (typeof TEMPLATE_CLEANUP_MODES)[number]

interface CleanupSeedDiff {
    removedEntities: Map<string, TemplateSeedEntity>
    removedSettings: Map<string, TemplateSeedSetting>
}

interface EntityCleanupCandidate {
    key: string
    objectId: string
    attributeIds: string[]
    elementIds: string[]
}

interface SettingCleanupCandidate {
    id: string
    key: string
}

interface CleanupPlanData {
    diff: CleanupSeedDiff
    entityCandidates: EntityCleanupCandidate[]
    settingCandidates: SettingCleanupCandidate[]
    blockers: string[]
    notes: string[]
}

export interface TemplateSeedCleanupSummary {
    entitiesDeleted: number
    attributesDeleted: number
    elementsDeleted: number
    settingsDeleted: number
}

export interface TemplateSeedCleanupResult {
    mode: TemplateCleanupMode
    hasChanges: boolean
    blockers: string[]
    notes: string[]
    summary: TemplateSeedCleanupSummary
}

const zeroSummary = (): TemplateSeedCleanupSummary => ({
    entitiesDeleted: 0,
    attributesDeleted: 0,
    elementsDeleted: 0,
    settingsDeleted: 0
})

const buildEntityKey = (entity: Pick<TemplateSeedEntity, 'kind' | 'codename'>): string => `${entity.kind}:${entity.codename}`

const parseEntityKey = (key: string): { kind: string; codename: string } => {
    const [kind, codename] = key.split(':', 2)
    return { kind: kind ?? '', codename: codename ?? '' }
}

const normalizeSettingValue = (setting: TemplateSeedSetting): unknown =>
    typeof setting.value === 'object' ? setting.value : { _value: setting.value }

const jsonEquals = (left: unknown, right: unknown): boolean => stableStringify(left) === stableStringify(right)

const toStringValue = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    return String(value ?? '')
}

export class TemplateSeedCleanupService {
    constructor(private readonly knex: Knex, private readonly schemaName: string) {}

    async analyze(params: {
        mode: TemplateCleanupMode
        currentSeed: MetahubTemplateSeed | null
        targetSeed: MetahubTemplateSeed | null
    }): Promise<TemplateSeedCleanupResult> {
        if (params.mode === 'keep') {
            return {
                mode: 'keep',
                hasChanges: false,
                blockers: [],
                notes: ['Cleanup mode is keep: destructive cleanup is disabled.'],
                summary: zeroSummary()
            }
        }

        const plan = await this.buildPlan(params.currentSeed, params.targetSeed)
        return {
            mode: params.mode,
            hasChanges: plan.entityCandidates.length > 0 || plan.settingCandidates.length > 0,
            blockers: plan.blockers,
            notes: plan.notes,
            summary: {
                entitiesDeleted: plan.entityCandidates.length,
                attributesDeleted: plan.entityCandidates.reduce((sum, candidate) => sum + candidate.attributeIds.length, 0),
                elementsDeleted: plan.entityCandidates.reduce((sum, candidate) => sum + candidate.elementIds.length, 0),
                settingsDeleted: plan.settingCandidates.length
            }
        }
    }

    async apply(params: {
        mode: TemplateCleanupMode
        currentSeed: MetahubTemplateSeed | null
        targetSeed: MetahubTemplateSeed | null
        actorId?: string | null
    }): Promise<TemplateSeedCleanupResult> {
        if (params.mode !== 'confirm') {
            return this.analyze(params)
        }

        const plan = await this.buildPlan(params.currentSeed, params.targetSeed)
        if (plan.blockers.length > 0) {
            return {
                mode: 'confirm',
                hasChanges: plan.entityCandidates.length > 0 || plan.settingCandidates.length > 0,
                blockers: plan.blockers,
                notes: plan.notes,
                summary: {
                    entitiesDeleted: plan.entityCandidates.length,
                    attributesDeleted: plan.entityCandidates.reduce((sum, candidate) => sum + candidate.attributeIds.length, 0),
                    elementsDeleted: plan.entityCandidates.reduce((sum, candidate) => sum + candidate.elementIds.length, 0),
                    settingsDeleted: plan.settingCandidates.length
                }
            }
        }

        const now = new Date()
        const actorId = params.actorId ?? null
        const summary = zeroSummary()

        await this.knex.transaction(async (trx) => {
            for (const candidate of plan.settingCandidates) {
                await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_settings')
                    .where({ id: candidate.id, _upl_deleted: false, _mhb_deleted: false })
                    .update({
                        _mhb_deleted: true,
                        _mhb_deleted_at: now,
                        _mhb_deleted_by: actorId,
                        _upl_updated_at: now,
                        _upl_updated_by: actorId,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
                summary.settingsDeleted += 1
            }

            for (const candidate of plan.entityCandidates) {
                if (candidate.attributeIds.length > 0) {
                    await trx
                        .withSchema(this.schemaName)
                        .from('_mhb_attributes')
                        .whereIn('id', candidate.attributeIds)
                        .where({ _upl_deleted: false, _mhb_deleted: false })
                        .update({
                            _mhb_deleted: true,
                            _mhb_deleted_at: now,
                            _mhb_deleted_by: actorId,
                            _upl_updated_at: now,
                            _upl_updated_by: actorId,
                            _upl_version: trx.raw('_upl_version + 1')
                        })
                    summary.attributesDeleted += candidate.attributeIds.length
                }

                if (candidate.elementIds.length > 0) {
                    await trx
                        .withSchema(this.schemaName)
                        .from('_mhb_elements')
                        .whereIn('id', candidate.elementIds)
                        .where({ _upl_deleted: false, _mhb_deleted: false })
                        .update({
                            _mhb_deleted: true,
                            _mhb_deleted_at: now,
                            _mhb_deleted_by: actorId,
                            _upl_updated_at: now,
                            _upl_updated_by: actorId,
                            _upl_version: trx.raw('_upl_version + 1')
                        })
                    summary.elementsDeleted += candidate.elementIds.length
                }

                await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_objects')
                    .where({ id: candidate.objectId, _upl_deleted: false, _mhb_deleted: false })
                    .update({
                        _mhb_deleted: true,
                        _mhb_deleted_at: now,
                        _mhb_deleted_by: actorId,
                        _upl_updated_at: now,
                        _upl_updated_by: actorId,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
                summary.entitiesDeleted += 1
            }
        })

        return {
            mode: 'confirm',
            hasChanges: summary.entitiesDeleted > 0 || summary.settingsDeleted > 0,
            blockers: [],
            notes: [
                `Removed entities: ${summary.entitiesDeleted}, attributes: ${summary.attributesDeleted}, elements: ${summary.elementsDeleted}, settings: ${summary.settingsDeleted}`
            ],
            summary
        }
    }

    private async buildPlan(currentSeed: MetahubTemplateSeed | null, targetSeed: MetahubTemplateSeed | null): Promise<CleanupPlanData> {
        const blockers: string[] = []
        const notes: string[] = []

        if (!currentSeed && !targetSeed) {
            notes.push('Both current and target template seeds are unavailable; cleanup is not required.')
            return {
                diff: { removedEntities: new Map(), removedSettings: new Map() },
                entityCandidates: [],
                settingCandidates: [],
                blockers,
                notes
            }
        }
        if (!currentSeed) {
            blockers.push('Current template seed is unavailable. Cleanup cannot be analyzed safely.')
            return {
                diff: { removedEntities: new Map(), removedSettings: new Map() },
                entityCandidates: [],
                settingCandidates: [],
                blockers,
                notes
            }
        }
        if (!targetSeed) {
            blockers.push('Target template seed is unavailable. Cleanup cannot be analyzed safely.')
            return {
                diff: { removedEntities: new Map(), removedSettings: new Map() },
                entityCandidates: [],
                settingCandidates: [],
                blockers,
                notes
            }
        }

        const diff = this.calculateRemovedSeed(currentSeed, targetSeed)
        const entityCandidates: EntityCleanupCandidate[] = []
        const settingCandidates: SettingCleanupCandidate[] = []

        for (const [entityKey, entity] of diff.removedEntities) {
            const { kind, codename } = parseEntityKey(entityKey)
            const objectRow = await this.knex
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ kind, codename, _upl_deleted: false, _mhb_deleted: false })
                .select(['id', '_upl_created_by', '_upl_updated_by'])
                .first()

            if (!objectRow) {
                notes.push(`Entity ${entityKey} is absent in schema; cleanup not required.`)
                continue
            }

            const entityBlockers: string[] = []
            if (objectRow._upl_created_by || objectRow._upl_updated_by) {
                entityBlockers.push('Entity has non-system audit provenance (created/updated by user).')
            }

            const liveAttributes = await this.knex
                .withSchema(this.schemaName)
                .from('_mhb_attributes')
                .where({ object_id: objectRow.id, _upl_deleted: false, _mhb_deleted: false })
                .select(['id', 'codename', '_upl_created_by', '_upl_updated_by'])
            const allowedAttributeCodes = new Set((entity.attributes ?? []).map((attribute) => attribute.codename))
            for (const attr of liveAttributes) {
                if (!allowedAttributeCodes.has(toStringValue(attr.codename))) {
                    entityBlockers.push(`Attribute "${toStringValue(attr.codename)}" was added outside template seed.`)
                }
                if (attr._upl_created_by || attr._upl_updated_by) {
                    entityBlockers.push(`Attribute "${toStringValue(attr.codename)}" has non-system audit provenance.`)
                }
            }

            const currentSeedElements = currentSeed.elements?.[codename] ?? []
            const liveElements = await this.knex
                .withSchema(this.schemaName)
                .from('_mhb_elements')
                .where({ object_id: objectRow.id, _upl_deleted: false, _mhb_deleted: false })
                .select(['id', 'sort_order', 'data', '_upl_created_by', '_upl_updated_by'])

            const expectedElementKeys = new Set(currentSeedElements.map((element) => this.buildElementKey(element)))
            for (const elementRow of liveElements) {
                const elementKey = this.buildElementKey({
                    codename: '',
                    sortOrder: Number(elementRow.sort_order),
                    data: (elementRow.data as Record<string, unknown>) ?? {}
                })
                if (!expectedElementKeys.has(elementKey)) {
                    entityBlockers.push(`Element at sort=${Number(elementRow.sort_order)} does not match template seed payload.`)
                }
                if (elementRow._upl_created_by || elementRow._upl_updated_by) {
                    entityBlockers.push(`Element at sort=${Number(elementRow.sort_order)} has non-system audit provenance.`)
                }
            }

            if (entityBlockers.length > 0) {
                blockers.push(`Entity ${entityKey} cleanup blocked: ${entityBlockers.join(' ')}`)
                continue
            }

            entityCandidates.push({
                key: entityKey,
                objectId: toStringValue(objectRow.id),
                attributeIds: liveAttributes.map((row) => toStringValue(row.id)),
                elementIds: liveElements.map((row) => toStringValue(row.id))
            })
        }

        for (const [settingKey, setting] of diff.removedSettings) {
            const row = await this.knex
                .withSchema(this.schemaName)
                .from('_mhb_settings')
                .where({ key: settingKey, _upl_deleted: false, _mhb_deleted: false })
                .select(['id', 'value', '_upl_created_by', '_upl_updated_by'])
                .first()

            if (!row) {
                notes.push(`Setting "${settingKey}" is absent in schema; cleanup not required.`)
                continue
            }

            if (row._upl_created_by || row._upl_updated_by) {
                blockers.push(`Setting "${settingKey}" cleanup blocked: non-system audit provenance detected.`)
                continue
            }

            const seedValue = normalizeSettingValue(setting)
            if (!jsonEquals(row.value, seedValue)) {
                blockers.push(`Setting "${settingKey}" cleanup blocked: current value differs from template seed baseline.`)
                continue
            }

            settingCandidates.push({ id: toStringValue(row.id), key: settingKey })
        }

        return { diff, entityCandidates, settingCandidates, blockers, notes }
    }

    private calculateRemovedSeed(currentSeed: MetahubTemplateSeed, targetSeed: MetahubTemplateSeed): CleanupSeedDiff {
        const currentEntities = new Map((currentSeed.entities ?? []).map((entity) => [buildEntityKey(entity), entity]))
        const targetEntityKeys = new Set((targetSeed.entities ?? []).map((entity) => buildEntityKey(entity)))
        const removedEntities = new Map<string, TemplateSeedEntity>()
        for (const [key, entity] of currentEntities) {
            if (!targetEntityKeys.has(key)) {
                removedEntities.set(key, entity)
            }
        }

        const currentSettings = new Map((currentSeed.settings ?? []).map((setting) => [setting.key, setting]))
        const targetSettingKeys = new Set((targetSeed.settings ?? []).map((setting) => setting.key))
        const removedSettings = new Map<string, TemplateSeedSetting>()
        for (const [key, setting] of currentSettings) {
            if (!targetSettingKeys.has(key)) {
                removedSettings.set(key, setting)
            }
        }

        return { removedEntities, removedSettings }
    }

    private buildElementKey(element: TemplateSeedElement): string {
        return `${element.sortOrder}:${stableStringify(element.data ?? {})}`
    }
}
