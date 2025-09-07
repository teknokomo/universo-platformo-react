import { createEntitiesRouter } from './routes/entitiesRoutes'
import { EntityStatus } from './database/entities/EntityStatus'
import { EntityTemplate } from './database/entities/EntityTemplate'
import { Entity } from './database/entities/Entity'
import { EntityOwner } from './database/entities/EntityOwner'
import { EntityResource } from './database/entities/EntityResource'
import { EntityRelation } from './database/entities/EntityRelation'
import { entitiesMigrations } from './database/migrations/postgres'

export { createEntitiesRouter, EntityStatus, EntityTemplate, Entity, EntityOwner, EntityResource, EntityRelation, entitiesMigrations }

export const entitiesEntities = [EntityStatus, EntityTemplate, Entity, EntityOwner, EntityResource, EntityRelation]
