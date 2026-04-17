import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import ValueGroupDeleteDialog from '../ValueGroupDeleteDialog'
import type { ValueGroupEntity } from '../../types'
import { getBlockingValueGroupReferences } from '../../domains/entities/presets/api/valueGroups'

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
    entity: ValueGroupEntity | null
    fetchBlockingEntities: () => Promise<{ blockingEntities: Array<Record<string, unknown>> }>
    getBlockingEntityLink: (row: Record<string, unknown>) => string
    onConfirm: (entity: ValueGroupEntity) => void
    labels: {
        blockingWarning: string
    }
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

vi.mock('../../domains/entities/presets/api/valueGroups', async () => {
    const actual = await vi.importActual<typeof import('../../domains/entities/presets/api/valueGroups')>(
        '../../domains/entities/presets/api/valueGroups'
    )
    return {
        ...actual,
        getBlockingValueGroupReferences: vi.fn()
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

describe('ValueGroupDeleteDialog', () => {
    const setEntity: ValueGroupEntity = {
        id: 'set-1',
        metahubId: 'metahub-1',
        codename: 'ProductsSet',
        name: createVlc('Products Set'),
        description: createVlc('Set description'),
        isSingleHub: false,
        isRequiredHub: false,
        sortOrder: 1,
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        latestDialogProps = null
        mockUseParams.mockReturnValue({})
    })

    it('maps blocking references to catalog/attribute rows and builds entity-owned catalog attribute links', async () => {
        vi.mocked(getBlockingValueGroupReferences).mockResolvedValue({
            valueGroupId: 'set-1',
            canDelete: false,
            blockingReferences: [
                {
                    sourceLinkedCollectionId: 'catalog-1',
                    sourceCatalogCodename: 'ProductsCatalog',
                    sourceCatalogName: null,
                    fieldDefinitionId: 'attr-1',
                    attributeCodename: 'OwnerRef',
                    attributeName: null
                }
            ]
        })

        render(
            <ValueGroupDeleteDialog
                open
                set={setEntity}
                metahubId='metahub-1'
                onClose={() => undefined}
                onConfirm={() => undefined}
                uiLocale='ru'
            />
        )

        expect(screen.getByTestId('blocking-entities-dialog')).toBeInTheDocument()
        expect(latestDialogProps).not.toBeNull()

        const dialogProps = latestDialogProps as MockBlockingDialogProps
        const result = await dialogProps.fetchBlockingEntities()
        const [firstRow] = result.blockingEntities

        expect(getBlockingValueGroupReferences).toHaveBeenCalledWith('metahub-1', 'set-1', undefined)
        expect(dialogProps.labels.blockingWarning).toContain('linked-collection field definitions')
        expect(firstRow.sourceCatalogDisplayName).toBe('ProductsCatalog')
        expect(firstRow.attributeDisplayName).toBe('OwnerRef')
        expect(dialogProps.getBlockingEntityLink(firstRow)).toBe('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
    })

    it('builds catalog blocker links on the unified entity route even when the current surface kind is set', async () => {
        mockUseParams.mockReturnValue({ kindKey: 'set' })
        vi.mocked(getBlockingValueGroupReferences).mockResolvedValue({
            valueGroupId: 'set-1',
            canDelete: false,
            blockingReferences: [
                {
                    sourceLinkedCollectionId: 'catalog-1',
                    sourceCatalogCodename: 'ProductsCatalog',
                    sourceCatalogName: null,
                    fieldDefinitionId: 'attr-1',
                    attributeCodename: 'OwnerRef',
                    attributeName: null
                }
            ]
        })

        render(
            <ValueGroupDeleteDialog
                open
                set={setEntity}
                metahubId='metahub-1'
                onClose={() => undefined}
                onConfirm={() => undefined}
                uiLocale='en'
            />
        )

        const dialogProps = latestDialogProps as MockBlockingDialogProps
        const result = await dialogProps.fetchBlockingEntities()
        const [firstRow] = result.blockingEntities

        expect(getBlockingValueGroupReferences).toHaveBeenCalledWith('metahub-1', 'set-1', 'set')
        expect(dialogProps.getBlockingEntityLink(firstRow)).toBe('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
    })
})
