import { Metahub } from './Metahub'
import { MetahubBranch } from './MetahubBranch'
import { MetahubUser } from './MetahubUser'
import { Publication } from './Publication'
import { PublicationVersion } from './PublicationVersion'

export * from './Metahub'
export * from './MetahubBranch'
export * from './MetahubUser'
export * from './Publication'
export * from './PublicationVersion'

/**
 * TypeORM entities for the metahubs schema.
 *
 * Note: Hub entity was removed. Hubs are now stored in isolated schemas
 * as rows in _mhb_objects table with kind='HUB'.
 */
export const metahubsEntities = [
    Metahub,
    MetahubBranch,
    MetahubUser,
    Publication,
    PublicationVersion
]
