import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { metahubsEntities } from '@universo/metahubs-backend'
import { applicationsEntities } from '@universo/applications-backend'
import { adminEntities } from '@universo/admin-backend'

// TypeORM entities here are constructor functions/classes; we only need their names and references
const metahubsEntitiesObject = Object.fromEntries(metahubsEntities.map((entity) => [entity.name, entity]))

const applicationsEntitiesObject = Object.fromEntries(applicationsEntities.map((entity) => [entity.name, entity]))

const adminEntitiesObject = Object.fromEntries(adminEntities.map((entity) => [entity.name, entity]))

export const entities = {
    // Metahubs service entities
    ...metahubsEntitiesObject,
    // Applications service entities
    ...applicationsEntitiesObject,
    AuthUser,
    // Profile entities
    Profile,
    // Admin RBAC entities
    ...adminEntitiesObject
}
