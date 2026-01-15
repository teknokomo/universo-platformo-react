import { Metahub } from './Metahub'
import { MetahubUser } from './MetahubUser'
import { Hub } from './Hub'
import { Catalog } from './Catalog'
import { CatalogHub } from './CatalogHub'
import { Attribute } from './Attribute'
import { HubRecord } from './Record'

// Export all metahubs entities as array for TypeORM registration
export const metahubsEntities = [Metahub, MetahubUser, Hub, Catalog, CatalogHub, Attribute, HubRecord]

// Re-export individual entities
export { Metahub } from './Metahub'
export { MetahubUser } from './MetahubUser'
export { Hub } from './Hub'
export { Catalog } from './Catalog'
export { CatalogHub } from './CatalogHub'
export { Attribute, AttributeDataType } from './Attribute'
export type { AttributeValidation, AttributeUIConfig } from './Attribute'
export { HubRecord } from './Record'

