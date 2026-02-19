import { Application } from './Application'
import { ApplicationUser } from './ApplicationUser'
import { Connector } from './Connector'
import { ConnectorPublication } from './ConnectorPublication'

// Export all applications entities as array for TypeORM registration
export const applicationsEntities = [Application, ApplicationUser, Connector, ConnectorPublication]

// Re-export individual entities
export { Application, ApplicationSchemaStatus } from './Application'
export { ApplicationUser } from './ApplicationUser'
export { Connector } from './Connector'
export { ConnectorPublication } from './ConnectorPublication'
