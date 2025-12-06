import { Instance } from './Instance'
import { Role } from './Role'
import { RolePermission } from './RolePermission'
import { UserRole } from './UserRole'

/**
 * Admin entities for TypeORM DataSource registration
 */
export const adminEntities = [Instance, Role, RolePermission, UserRole]

export { Instance, Role, RolePermission, UserRole }
