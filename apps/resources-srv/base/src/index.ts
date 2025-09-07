import { createResourcesRouter } from './routes/resourcesRoutes'
import { ResourceCategory } from './database/entities/ResourceCategory'
import { ResourceState } from './database/entities/ResourceState'
import { StorageType } from './database/entities/StorageType'
import { Resource } from './database/entities/Resource'
import { ResourceRevision } from './database/entities/ResourceRevision'
import { ResourceComposition } from './database/entities/ResourceComposition'
import { resourcesMigrations } from './database/migrations/postgres'

export {
    createResourcesRouter,
    ResourceCategory,
    ResourceState,
    StorageType,
    Resource,
    ResourceRevision,
    ResourceComposition,
    resourcesMigrations
}

export const resourcesEntities = [ResourceCategory, ResourceState, StorageType, Resource, ResourceRevision, ResourceComposition]
