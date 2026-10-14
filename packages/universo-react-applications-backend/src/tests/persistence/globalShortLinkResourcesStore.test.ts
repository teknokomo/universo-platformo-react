import { listGlobalShortLinkResourceOptions } from '../../persistence/globalShortLinkResourcesStore'
import type { DbExecutor } from '@universo-react/utils'

describe('listGlobalShortLinkResourceOptions', () => {
    it('returns localized labels for active published layout-capable resource types only', async () => {
        const query = jest.fn().mockResolvedValue([
            {
                kind: 'page',
                codename: { _primary: 'ru', locales: { ru: { content: 'home' } } },
                presentation: { name: { _primary: 'ru', locales: { ru: { content: 'Главная' }, en: { content: 'Home' } } } }
            },
            {
                kind: 'quiz',
                codename: { _primary: 'en', locales: { en: { content: 'quizzes' } } },
                presentation: { name: { _primary: 'en', locales: { en: { content: 'Quizzes' } } } }
            },
            {
                kind: 'page',
                codename: 'invalid codename',
                presentation: { name: { locales: { ru: { content: 'Hidden invalid identity' } } } }
            }
        ])
        const executor = { query } as unknown as DbExecutor

        const schemaName = 'app_018f8a787b8f7c1da111222233334444'
        await expect(listGlobalShortLinkResourceOptions(executor, schemaName, 'ru')).resolves.toEqual([
            { targetKind: 'page', entityTypeCodename: 'home', label: 'Главная' },
            { targetKind: 'object', entityTypeCodename: 'quizzes', label: 'Quizzes' }
        ])

        expect(query).toHaveBeenCalledTimes(1)
        const [sql, params] = query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain(`"${schemaName}"."_app_objects"`)
        expect(sql).toMatch(/SELECT o\.kind, o\.codename, o\.presentation/u)
        expect(sql).toContain('"o"."_app_published"')
        expect(sql).toContain("'layoutConfig'")
        expect(sql).toContain("'ledgerSchema'")
        expect(sql).toMatch(/LIMIT \$1/u)
        expect(params).toEqual([100])
    })
})
