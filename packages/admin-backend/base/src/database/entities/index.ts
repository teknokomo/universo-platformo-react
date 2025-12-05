import { Role } from './Role'
import { RolePermission } from './RolePermission'
import { UserRole } from './UserRole'

/**
 * Admin entities for TypeORM DataSource registration
 */
export const adminEntities = [Role, RolePermission, UserRole]

export { Role, RolePermission, UserRole }
