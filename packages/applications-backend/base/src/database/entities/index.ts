import { Application, ApplicationSchemaStatus } from './Application'
import { ApplicationUser } from './ApplicationUser'
import { Connector } from './Connector'
import { ConnectorMetahub } from './ConnectorMetahub'

// Export all applications entities as array for TypeORM registration
export const applicationsEntities = [
    Application,
    ApplicationUser,
    Connector,
    ConnectorMetahub
]

// Re-export individual entities
export { Application, ApplicationSchemaStatus } from './Application'
export { ApplicationUser } from './ApplicationUser'
export { Connector } from './Connector'
export { ConnectorMetahub } from './ConnectorMetahub'
