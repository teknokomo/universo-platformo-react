import type { DbExecutor } from '@universo-react/utils'
import { builtinPackageSeeds } from '../../domains/packages/data'
import { PackageSeeder, builtinPackageSeedChecksumSource } from '../../domains/packages/services/PackageSeeder'

describe('PackageSeeder', () => {
    const exec: DbExecutor = {
        query: jest.fn()
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(exec.query).mockResolvedValue([{ id: 'pkg-1' }])
    })

    it('idempotently upserts the three built-in package registry entries', async () => {
        const logger = { info: jest.fn(), error: jest.fn() }

        await new PackageSeeder(exec, { logger, failFast: true }).seed()

        expect(exec.query).toHaveBeenCalledTimes(3)
        expect(builtinPackageSeeds.map((seed) => seed.packageName)).toEqual([
            '@universo-react/colyseus-client',
            '@universo-react/colyseus-server',
            '@universo-react/playcanvas-engine'
        ])
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (package_name, version)'), expect.any(Array))
        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith('[PackageSeeder] Seed complete: 3 upserted, 0 errors')
    })

    it('keeps the checksum source tied to seed package names, versions, and source descriptors', () => {
        expect(builtinPackageSeedChecksumSource).toContain('@universo-react/colyseus-client')
        expect(builtinPackageSeedChecksumSource).toContain('@universo-react/colyseus-server')
        expect(builtinPackageSeedChecksumSource).toContain('@universo-react/playcanvas-engine')
    })

    it('keeps PlayCanvas Engine product naming untranslated in Russian seed content', () => {
        const playcanvas = builtinPackageSeeds.find((seed) => seed.packageName === '@universo-react/playcanvas-engine')

        expect(playcanvas?.displayName.locales.ru.content).toBe('PlayCanvas Engine')
        expect(playcanvas?.description?.locales.ru.content).toContain('PlayCanvas Engine')
    })
})
