import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    usePublicationVersions: vi.fn(),
    useQuery: vi.fn()
}))

vi.mock('react-router-dom', () => ({
    useParams: () => ({ metahubId: 'metahub-1', publicationId: 'publication-1' })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'en' }
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: mocks.useQuery
}))

vi.mock('@universo/template-mui', () => ({
    useDebouncedSearch: ({ onSearchChange }: { onSearchChange: (value: string) => void }) => ({
        searchValue: '',
        handleSearchChange: (value: string) => onSearchChange(value)
    })
}))

vi.mock('../usePublicationVersions', () => ({
    usePublicationVersions: mocks.usePublicationVersions
}))

vi.mock('../../../branches/api/branches', () => ({
    listBranchOptions: vi.fn()
}))

import { usePublicationVersionListData } from '../usePublicationVersionListData'

describe('usePublicationVersionListData', () => {
    it('formats branch labels from localized codename text instead of object coercion', () => {
        mocks.usePublicationVersions.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'version-1',
                        versionNumber: 1,
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Version One' } }
                        },
                        description: null,
                        isActive: false,
                        createdAt: '2026-04-04T00:00:00.000Z',
                        branchId: 'branch-1'
                    }
                ]
            },
            isLoading: false,
            error: null
        })

        mocks.useQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'branch-1',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Main branch' } }
                        },
                        codename: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'MainBranch' }
                            }
                        }
                    }
                ],
                meta: {
                    defaultBranchId: 'branch-1'
                }
            }
        })

        const { result } = renderHook(() => usePublicationVersionListData())

        expect(result.current.getBranchLabel('branch-1')).toBe('Main branch (MainBranch)')
        expect(result.current.versions[0]?.branchLabel).toBe('Main branch (MainBranch)')
    })
})
