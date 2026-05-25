import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { useMetahubMigrationsList, useMetahubMigrationsPlan, useMetahubMigrationsStatus } from '../useMetahubMigrations'

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn()
}))

describe('useMetahubMigrations hooks', () => {
    beforeEach(() => {
        vi.mocked(useQuery).mockReset()
        vi.mocked(useQuery).mockReturnValue({} as ReturnType<typeof useQuery>)
    })

    it('disables retry for migrations list query', () => {
        useMetahubMigrationsList('metahub-1', { branchId: 'branch-1', limit: 20, offset: 0, enabled: true })

        expect(useQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                refetchOnWindowFocus: false,
                retry: false
            })
        )
    })

    it('disables retry for migrations plan query', () => {
        useMetahubMigrationsPlan('metahub-1', { branchId: 'branch-1', cleanupMode: 'keep', enabled: true })

        expect(useQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                refetchOnWindowFocus: false,
                retry: false
            })
        )
    })

    it('keeps retry disabled for migrations status query', () => {
        useMetahubMigrationsStatus('metahub-1', { branchId: 'branch-1', cleanupMode: 'keep', enabled: true })

        expect(useQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                refetchOnWindowFocus: false,
                retry: false
            })
        )
    })
})
