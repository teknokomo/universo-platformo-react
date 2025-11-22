import { Organization } from './Organization'
import { OrganizationUser } from './OrganizationUser'
import { Department } from './Department'
import { DepartmentOrganization } from './DepartmentOrganization'
import { Position } from './Position'
import { PositionOrganization } from './PositionOrganization'
import { PositionDepartment } from './PositionDepartment'

export const organizationsEntities = [
    Organization,
    OrganizationUser,
    Department,
    DepartmentOrganization,
    Position,
    PositionOrganization,
    PositionDepartment
]

export { Organization, OrganizationUser, Department, DepartmentOrganization, Position, PositionOrganization, PositionDepartment }
