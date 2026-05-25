import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import OptionListDeleteDialog from '../OptionListDeleteDialog'
import type { OptionListEntity } from '../../types'
import { getBlockingOptionListReferences } from '../../domains/entities/presets/api/optionLists'

const mockUseParams = vi.fn(() => ({}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key
        })
    }
})

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useParams: () => mockUseParams()
    }
})

type MockBlockingDialogProps = {
    entity: OptionListEntity | null
    fetchBlockingEntities: () => Promise<{ blockingEntities: Array<Record<string, unknown>> }>
    getBlockingEntityLink: (row: Record<string, unknown>) => string
}

let latestDialogProps: MockBlockingDialogProps | null = null

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/template-mui')>('@universo/template-mui')
    return {
        ...actual,
        BlockingEntitiesDeleteDialog: (props: MockBlockingDialogProps) => {
            latestDialogProps = props
            return <div data-testid='blocking-entities-dialog' />
        }
    }
})

vi.mock('../../domains/entities/presets/api/optionLists', async () => {
    const actual = await vi.importActual<typeof import('../../domains/entities/presets/api/optionLists')>(
        '../../domains/entities/presets/api/optionLists'
    )
    return {
        ...actual,
        getBlockingOptionListReferences: vi.fn()
    }
})

const createVlc = (value: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
})

describe('OptionListDeleteDialog', () => {
    const enumeration: OptionListEntity = {
        id: 'enumeration-1',
        metahubId: 'metahub-1',
        codename: 'Statuses',
        name: createVlc('Statuses'),
        description: createVlc('Status values'),
        isSingleHub: false,
        isRequiredHub: false,
        sortOrder: 1,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        latestDialogProps = null
        mockUseParams.mockReturnValue({ kindKey: 'enumeration' })
    })

    it('routes blocking object links to the object entity authoring surface on unified entity routes', async () => {
        vi.mocked(getBlockingOptionListReferences).mockResolvedValue({
            optionListId: 'enumeration-1',
            canDelete: false,
            blockingReferences: [
                {
                    sourceObjectCollectionId: 'object-1',
                    sourceObjectCodename: 'ProductsObject',
                    sourceObjectName: null,
                    componentId: 'component-1',
                    componentCodename: 'StatusRef',
                    componentName: null
                }
            ]
        })

        render(
            <OptionListDeleteDialog
                open
                enumeration={enumeration}
                metahubId='metahub-1'
                onClose={() => undefined}
                onConfirm={() => undefined}
                uiLocale='en'
            />
        )

        expect(screen.getByTestId('blocking-entities-dialog')).toBeInTheDocument()

        const dialogProps = latestDialogProps as MockBlockingDialogProps
        const result = await dialogProps.fetchBlockingEntities()
        const [firstRow] = result.blockingEntities

        expect(getBlockingOptionListReferences).toHaveBeenCalledWith('metahub-1', 'enumeration-1', 'enumeration')
        expect(dialogProps.getBlockingEntityLink(firstRow)).toBe('/metahub/metahub-1/entities/object/instance/object-1/components')
    })
})
