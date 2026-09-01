import { describe, expect, it, vi } from 'vitest'
import type { Publication } from '../../api'

vi.mock('@universo-react/template-mui', () => ({
    LocalizedInlineField: () => null,
    notifyError: vi.fn()
}))

vi.mock('../AccessPanel', () => ({
    AccessPanel: () => null
}))

import publicationActions from '../PublicationActions'

const createContext = (overrides: Record<string, unknown> = {}) => {
    const syncEntity = vi.fn().mockResolvedValue(undefined)
    const publication = {
        id: 'publication-1',
        metahubId: 'metahub-1',
        name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Publication' } } },
        schemaName: 'publication_schema',
        schemaStatus: 'outdated',
        activeVersionId: 'version-1'
    } as Publication

    return {
        context: {
            entity: { id: publication.id, name: 'Publication', description: '', accessMode: 'full' },
            publicationMap: new Map([[publication.id, publication]]),
            canManagePublication: true,
            isSyncing: false,
            api: { syncEntity },
            t: (key: string) => key,
            ...overrides
        } as any,
        syncEntity
    }
}

const getSyncAction = () => {
    const action = publicationActions.find((descriptor) => descriptor.id === 'sync')
    expect(action).toBeDefined()
    return action!
}

describe('PublicationActions sync', () => {
    it('exposes a localized sync action and calls the existing syncEntity API', async () => {
        const action = getSyncAction()
        const { context, syncEntity } = createContext()

        expect(action.labelKey).toBe('publications.actions.sync')
        expect(action.visible?.(context)).toBe(true)

        await action.onSelect?.(context)

        expect(syncEntity).toHaveBeenCalledWith('publication-1')
    })

    it.each([
        ['without manage permission', { canManagePublication: false }],
        ['without a sync handler', { api: {} }],
        ['without an active version', { publicationMap: new Map([['publication-1', { schemaStatus: 'outdated' }]]) }],
        [
            'while schema synchronization is pending',
            {
                publicationMap: new Map([['publication-1', { schemaStatus: 'pending', activeVersionId: 'version-1' }]])
            }
        ],
        ['for a pending optimistic entity', { entity: { id: 'publication-1', __pending: true } }]
    ])('does not expose the sync action %s', (_reason, overrides) => {
        const action = getSyncAction()
        const { context } = createContext(overrides)

        expect(action.visible?.(context)).toBe(false)
    })

    it('disables the action while the sync mutation is running', () => {
        const action = getSyncAction()
        const { context } = createContext({ isSyncing: true })

        expect(action.visible?.(context)).toBe(true)
        expect(action.enabled?.(context)).toBe(false)
    })
})
