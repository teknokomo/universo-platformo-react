import type { MetahubSnapshotPackage } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { listMetahubPackages } from '../../../persistence'

export class MetahubPackagesService {
    constructor(private readonly exec: DbExecutor) {}

    async listPublishedPackages(metahubId: string): Promise<MetahubSnapshotPackage[]> {
        const packages = await listMetahubPackages(this.exec, metahubId)
        return packages.map((item) => ({
            packageName: item.packageName,
            version: item.version,
            source: item.source
        }))
    }
}
