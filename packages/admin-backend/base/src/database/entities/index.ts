import { AdminSetting } from './AdminSetting'
import { Instance } from './Instance'
import { Locale } from './Locale'
import { Role } from './Role'
import { RolePermission } from './RolePermission'
import { UserRole } from './UserRole'

/**
 * Admin entities for TypeORM DataSource registration
 */
export const adminEntities = [AdminSetting, Instance, Locale, Role, RolePermission, UserRole]

export { AdminSetting, Instance, Locale, Role, RolePermission, UserRole }
