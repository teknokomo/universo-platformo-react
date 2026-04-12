import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import SetDeleteDialog from '../SetDeleteDialog'
import type { MetahubSet } from '../../types'
import { getBlockingSetReferences } from '../../domains/sets'

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key
        })
    }
})

type MockBlockingDialogProps = {
    entity: MetahubSet | null
    fetchBlockingEntities: () => Promise<{ blockingEntities: Array<Record<string, unknown>> }>
    getBlockingEntityLink: (row: Record<string, unknown>) => string
    onConfirm: (entity: MetahubSet) => void
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

vi.mock('../../domains/sets', async () => {
    const actual = await vi.importActual<typeof import('../../domains/sets')>('../../domains/sets')
    return {
        ...actual,
        getBlockingSetReferences: vi.fn()
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

describe('SetDeleteDialog', () => {
    const setEntity: MetahubSet = {
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
    })

    it('maps blocking references to catalog/attribute rows and builds catalog attribute links', async () => {
        vi.mocked(getBlockingSetReferences).mockResolvedValue({
            setId: 'set-1',
            canDelete: false,
            blockingReferences: [
                {
                    sourceCatalogId: 'catalog-1',
                    sourceCatalogCodename: 'ProductsCatalog',
                    sourceCatalogName: null,
                    attributeId: 'attr-1',
                    attributeCodename: 'OwnerRef',
                    attributeName: null
                }
            ]
        })

        render(
            <SetDeleteDialog
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

        expect(getBlockingSetReferences).toHaveBeenCalledWith('metahub-1', 'set-1', undefined)
        expect(dialogProps.labels.blockingWarning).toContain('catalog attributes')
        expect(firstRow.sourceCatalogDisplayName).toBe('ProductsCatalog')
        expect(firstRow.attributeDisplayName).toBe('OwnerRef')
        expect(dialogProps.getBlockingEntityLink(firstRow)).toBe('/metahub/metahub-1/catalog/catalog-1/attributes')
    })
})
