import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { RolePermission } from './RolePermission'
import { UserRole } from './UserRole'

/**
 * Role entity for RBAC system
 * Stored in admin.roles table
 *
 * Fields:
 * - is_superuser: Full bypass of all permission checks (only for 'superuser' role)
 * - is_system: System role that cannot be deleted
 * - Admin access is computed from permissions (roles:read, instances:read, or users:read)
 */
@Entity({ name: 'roles', schema: 'admin' })
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 50, unique: true })
    codename!: string

    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', name: 'name', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'varchar', length: 7, default: '#9e9e9e' })
    color!: string

    @Column({ type: 'boolean', name: 'is_superuser', default: false })
    is_superuser!: boolean

    @Column({ type: 'boolean', name: 'is_system', default: false })
    is_system!: boolean

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at!: Date

    @OneToMany(() => RolePermission, (rp) => rp.role)
    permissions?: RolePermission[]

    @OneToMany(() => UserRole, (ur) => ur.role)
    user_roles?: UserRole[]
}
