import type { DbExecutor } from '@universo-react/utils'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'

jest.mock('../../shared/publicRuntimeAccess', () => ({
    listActivePublicWorkspaceIds: jest.fn(),
    resolveTopLevelComponents: jest.fn(),
    setPublicWorkspaceContext: jest.fn()
}))

import { listActivePublicWorkspaceIds, resolveTopLevelComponents, setPublicWorkspaceContext } from '../../shared/publicRuntimeAccess'
import { createEligiblePublicQuizAccessLinksHandler } from '../../controllers/runtimeGuest/eligibleQuizAccessLinksHandler'
import type { RuntimeGuestServices } from '../../controllers/runtimeGuest/services'

const mockListActivePublicWorkspaceIds = jest.mocked(listActivePublicWorkspaceIds)
const mockResolveTopLevelComponents = jest.mocked(resolveTopLevelComponents)
const mockSetPublicWorkspaceContext = jest.mocked(setPublicWorkspaceContext)

const workspaceA = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const workspaceB = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
const runtimeConfig = {
    objects: { accessLinks: 'AccessLinks' },
    fields: {
        accessLink: {
            slug: 'Slug',
            targetType: 'TargetType',
            targetId: 'TargetId',
            isActive: 'IsActive',
            expiresAt: 'ExpiresAt',
            maxUses: 'MaxUses',
            useCount: 'UseCount',
            title: 'Title'
        }
    }
} as unknown as PublicGuestRuntimeConfig

const makeId = (index: number) => `019ccefc-2f7b-7b36-82f4-85cdb131${String(index).padStart(4, '0')}`

const makeRow = (index: number, slug: string) => ({
    id: makeId(index),
    slug,
    target_type: 'quiz',
    target_id: makeId(index + 1000),
    is_active: true,
    expires_at: null,
    max_uses: null,
    use_count: 0,
    title: null
})

const makeServices = (workspaceIds: Array<string | null>, rowsByWorkspace: Map<string | null, ReturnType<typeof makeRow>[]>) => {
    const context = {
        manager: {
            query: jest.fn(async (sql: string, parameters: unknown[] = []) => {
                if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                    return workspaceIds
                        .filter((workspaceId): workspaceId is string => workspaceId !== null)
                        .map((id) => ({ id, name: { _primary: 'en', en: 'Grade 6', ru: '6 класс' } }))
                }
                const workspaceId = sql.includes('workspace_id') ? (parameters[0] as string) : null
                return rowsByWorkspace.get(workspaceId) ?? []
            })
        } as unknown as DbExecutor,
        schemaName,
        workspacesEnabled: workspaceIds.some((workspaceId) => workspaceId !== null),
        settings: {}
    }
    const services = {
        withPublicRuntimeContext: async (_applicationId: string, _res: unknown, callback: (ctx: typeof context) => Promise<void>) =>
            callback(context),
        requirePublicGuestRuntimeConfig: jest.fn(() => runtimeConfig),
        resolveAccessLinksBinding: jest.fn(async () => ({ tableName: 'obj_access_links' })),
        assertAccessLinkAvailable: jest.fn(() => ({ ok: true })),
        loadAccessLinkRecord: jest.fn(async (_executor, _schema, _config, _enabled, slug, _forUpdate, workspaceId) => {
            const row = [...rowsByWorkspace.entries()]
                .find(([scope, rows]) => scope === (workspaceId ?? null) && rows.some((candidate) => candidate.slug === slug))?.[1]
                .find((candidate) => candidate.slug === slug)
            if (!row) return null
            return {
                id: row.id,
                slug: row.slug,
                title: row.title,
                targetType: row.target_type,
                targetId: row.target_id,
                isActive: row.is_active,
                expiresAt: row.expires_at,
                maxUses: row.max_uses,
                useCount: row.use_count,
                workspaceId: workspaceId ?? null
            }
        }),
        resolveAllowedRuntimeTarget: jest.fn(async (_executor, _schema, _config, link) => ({ type: 'quiz', id: link.targetId })),
        buildQuizPayload: jest.fn(async (_executor, _schema, _config, _targetId) => ({
            type: 'quiz',
            title: 'Marathon quiz',
            questions: [{ options: [{ isCorrect: true }, { isCorrect: false }] }]
        }))
    } as unknown as RuntimeGuestServices
    const response = { json: jest.fn() }

    return { handler: createEligiblePublicQuizAccessLinksHandler(services), context, response, services }
}

describe('eligible public quiz access links handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveTopLevelComponents.mockReturnValue([
            { codename: 'Slug', column_name: 'slug' },
            { codename: 'TargetType', column_name: 'target_type' },
            { codename: 'TargetId', column_name: 'target_id' },
            { codename: 'IsActive', column_name: 'is_active' },
            { codename: 'ExpiresAt', column_name: 'expires_at' },
            { codename: 'MaxUses', column_name: 'max_uses' },
            { codename: 'UseCount', column_name: 'use_count' },
            { codename: 'Title', column_name: 'title' }
        ] as never)
        mockSetPublicWorkspaceContext.mockResolvedValue(true)
    })

    it('preserves a repeated slug as distinct options in each active public workspace', async () => {
        mockListActivePublicWorkspaceIds.mockResolvedValue([workspaceA, workspaceB])
        const rowsByWorkspace = new Map([
            [workspaceA, [makeRow(1, 'grade-6')]],
            [workspaceB, [makeRow(2, 'grade-6')]]
        ])
        const { handler, response } = makeServices([workspaceA, workspaceB], rowsByWorkspace)

        await handler({ params: { applicationId: 'application-1' }, query: { locale: 'en' } } as never, response as never)

        expect(response.json).toHaveBeenCalledWith({
            items: [
                { id: makeId(1), slug: 'grade-6', label: 'Marathon quiz', workspaceId: workspaceA, workspaceLabel: 'Grade 6 · 1' },
                { id: makeId(2), slug: 'grade-6', label: 'Marathon quiz', workspaceId: workspaceB, workspaceLabel: 'Grade 6 · 2' }
            ]
        })
    })

    it('caps the response at the 100-item shared API limit', async () => {
        mockListActivePublicWorkspaceIds.mockResolvedValue([])
        const rows = Array.from({ length: 101 }, (_, index) => makeRow(index + 1, `quiz-${String(index).padStart(3, '0')}`))
        const { handler, response } = makeServices([null], new Map([[null, rows]]))

        await handler({ params: { applicationId: 'application-1' }, query: { locale: 'en' } } as never, response as never)

        const payload = response.json.mock.calls[0]?.[0] as { items: Array<{ slug: string }> }
        expect(payload.items).toHaveLength(100)
        expect(payload.items[0]?.slug).toBe('quiz-000')
        expect(payload.items.at(-1)?.slug).toBe('quiz-099')
    })

    it('returns an empty option list when the application has no guest runtime configuration', async () => {
        mockListActivePublicWorkspaceIds.mockResolvedValue([])
        const { handler, response, services } = makeServices([null], new Map([[null, []]]))
        jest.mocked(services.requirePublicGuestRuntimeConfig).mockReturnValue(null)

        await handler({ params: { applicationId: 'application-1' }, query: { locale: 'en' } } as never, response as never)

        expect(response.json).toHaveBeenCalledWith({ items: [] })
    })
})
