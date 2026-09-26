import { buildSingleTargetWidgetBinding, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import {
    loadMarketingHeroBindingBySemanticTarget,
    loadMarketingHeroBindingTarget,
    projectMarketingHeroContentData
} from '../../domains/layouts/marketingHeroBindingsStore'

const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const objectId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a2'

const policy = {
    version: 1,
    semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
    denyDeleteWhenBound: true,
    immutableSemanticKeyWhenBound: true,
    runtimeMutation: 'deny',
    requiredLocales: ['en', 'ru'],
    validatorKey: 'marketing.hero.v1'
}

const localized = (en: string, ru: string) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: { content: en, isActive: true },
        ru: { content: ru, isActive: true }
    }
})

const data = {
    HeroKey: 'hero-default',
    Title: localized('Welcome', 'Добро пожаловать'),
    Description: localized('A product overview', 'Описание продукта'),
    EmailLabel: localized('Email', 'Электронная почта'),
    EmailPlaceholder: localized('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localized('Get started', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/auth' }
}

const componentRows = () => {
    const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
    const requirements = definition?.bindingSlots?.find(({ key }) => key === 'content')?.requirements.components
    if (!requirements) throw new Error('Marketing Hero binding slot is missing')

    return requirements.map((component) => ({
        codename: component.componentCodename,
        data_type: component.valueType === 'json' ? 'JSON' : 'STRING',
        is_required: component.required,
        validation_rules: {
            localized: component.localized,
            ...(component.semanticKey ? { unique: true } : {}),
            ...(component.maxLength ? { maxLength: component.maxLength } : {}),
            ...(component.format ? { format: component.format } : {})
        }
    }))
}

const createDb = (components = componentRows()) => {
    const sqlCalls: Array<{ sql: string; params?: unknown[] }> = []
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        sqlCalls.push({ sql, params })
        if (sql.includes('pg_advisory_xact_lock')) return []
        if (sql.includes('SELECT object_id') && sql.includes('"_mhb_elements"')) return [{ object_id: objectId }]
        if (sql.includes('SELECT id, kind')) {
            return [{ id: objectId, kind: 'object', codename: 'MarketingPageHero', config: { recordPolicy: policy } }]
        }
        if (sql.includes('FROM') && sql.includes('"_mhb_objects"') && sql.includes('SELECT id FROM')) return [{ id: objectId }]
        if (sql.includes('data_type, is_required, validation_rules')) return components
        if (sql.includes('SELECT id, data')) return [{ id: recordId, data, version: 7 }]
        if (sql.includes('data ->>')) return [{ id: recordId }]
        return []
    })
    return { db: { query } as unknown as SqlQueryable, query, sqlCalls }
}

describe('marketing Hero binding target loader', () => {
    it('omits null optional projections and rejects null required localized fields', () => {
        const projected = projectMarketingHeroContentData({
            ...data,
            HeroKey: 'hero-null-projection',
            Accent: null,
            TermsText: null,
            TermsLinkLabel: null,
            TermsAction: null
        })

        expect(projected).not.toHaveProperty('accent')
        expect(projected).not.toHaveProperty('termsText')
        expect(projected).not.toHaveProperty('termsLinkLabel')
        expect(projected).not.toHaveProperty('termsAction')
        expect(projected).not.toHaveProperty('HeroKey')
        expect(() => projectMarketingHeroContentData({ ...data, Title: null })).toThrow()
    })

    it('locks the authoritative Object and record and returns a registry-derived semantic binding', async () => {
        const { db, sqlCalls } = createDb()

        const result = await loadMarketingHeroBindingTarget(db, schemaName, recordId, 'ru')

        expect(result).toMatchObject({
            recordId,
            recordVersion: 7,
            label: 'Добро пожаловать',
            data: {
                title: { en: 'Welcome', ru: 'Добро пожаловать' },
                primaryAction: { kind: 'internal', path: '/auth' }
            },
            binding: {
                version: 1,
                slots: [
                    {
                        slot: 'content',
                        targets: [
                            {
                                entityKind: 'object',
                                entityCodename: 'MarketingPageHero',
                                selector: { kind: 'semantic-key', field: 'key', value: 'hero-default' }
                            }
                        ]
                    }
                ]
            }
        })
        expect(JSON.stringify(result.binding)).not.toContain(recordId)

        const graphLockIndex = sqlCalls.findIndex(({ sql }) => sql.includes('pg_advisory_xact_lock'))
        const objectLockIndex = sqlCalls.findIndex(({ sql }) => sql.includes('SELECT id, kind') && sql.includes('FOR UPDATE'))
        const recordLockIndex = sqlCalls.findIndex(({ sql }) => sql.includes('SELECT id, data') && sql.includes('FOR SHARE'))
        expect(graphLockIndex).toBeGreaterThanOrEqual(0)
        expect(objectLockIndex).toBeGreaterThan(graphLockIndex)
        expect(recordLockIndex).toBeGreaterThan(objectLockIndex)

        const semanticLookup = sqlCalls.find(({ sql }) => sql.includes('data ->>'))
        expect(semanticLookup?.params).toEqual([objectId, 'HeroKey', 'hero-default'])
        expect(semanticLookup?.sql).not.toContain('hero-default')
    })

    it('fails closed when Entity Component metadata does not satisfy the registry', async () => {
        const components = componentRows().map((component) =>
            component.codename === 'Title' ? { ...component, data_type: 'JSON' } : component
        )
        const { db, sqlCalls } = createDb(components)

        await expect(loadMarketingHeroBindingTarget(db, schemaName, recordId, 'en')).rejects.toMatchObject({
            statusCode: 400,
            message: 'Hero Entity Components do not match the registered binding slot'
        })
        expect(sqlCalls.some(({ sql }) => sql.includes('SELECT id, data'))).toBe(false)
    })

    it.each(['PrimaryAction', 'TermsAction'])('fails closed when %s validator format differs from the registry', async (codename) => {
        const components = componentRows().map((component) =>
            component.codename === codename
                ? {
                      ...component,
                      validation_rules: { ...(component.validation_rules as Record<string, unknown>), format: 'untrusted' }
                  }
                : component
        )
        const { db, sqlCalls } = createDb(components)

        await expect(loadMarketingHeroBindingTarget(db, schemaName, recordId, 'en')).rejects.toMatchObject({
            statusCode: 400,
            message: 'Hero Entity Components do not match the registered binding slot'
        })
        expect(sqlCalls.some(({ sql }) => sql.includes('SELECT id, data'))).toBe(false)
    })

    it('fails closed when a required action Component omits its validator format', async () => {
        const components = componentRows().map((component) => {
            if (component.codename !== 'PrimaryAction') return component
            const validationRules = { ...(component.validation_rules as Record<string, unknown>) }
            delete validationRules.format
            return { ...component, validation_rules: validationRules }
        })
        const { db, sqlCalls } = createDb(components)

        await expect(loadMarketingHeroBindingTarget(db, schemaName, recordId, 'en')).rejects.toMatchObject({
            statusCode: 400,
            message: 'Hero Entity Components do not match the registered binding slot'
        })
        expect(sqlCalls.some(({ sql }) => sql.includes('SELECT id, data'))).toBe(false)
    })

    it('resolves a semantic target once and reuses its locked Object and record context', async () => {
        const { db, sqlCalls } = createDb()
        const definition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!definition) throw new Error('Marketing Hero widget definition is missing')
        const binding = buildSingleTargetWidgetBinding(definition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })

        const result = await loadMarketingHeroBindingBySemanticTarget(db, schemaName, binding, 'ru', {
            layoutGraphLockAlreadyHeld: true
        })

        expect(result).toMatchObject({ recordId, recordVersion: 7, label: 'Добро пожаловать' })
        expect(sqlCalls.filter(({ sql }) => sql.includes('SELECT id FROM') && sql.includes('"_mhb_objects"'))).toHaveLength(0)
        expect(sqlCalls.filter(({ sql }) => sql.includes('SELECT id, kind') && sql.includes('FOR UPDATE'))).toHaveLength(1)
        expect(sqlCalls.filter(({ sql }) => sql.includes('"_mhb_elements"') && sql.includes('data ->>'))).toHaveLength(1)
        expect(sqlCalls.some(({ sql }) => sql.includes('"_mhb_elements"') && sql.includes('WHERE id = $1'))).toBe(false)
        expect(sqlCalls.filter(({ sql }) => sql.includes('pg_advisory_xact_lock'))).toHaveLength(0)
    })
})
