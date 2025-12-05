import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'
import type { LocalizedString } from '@universo/types'
import { RolePermission } from './RolePermission'
import { UserRole } from './UserRole'

/**
 * Role entity for RBAC system
 * Stored in admin.roles table
 */
@Entity({ name: 'roles', schema: 'admin' })
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 50, unique: true })
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'jsonb', name: 'display_name', default: {} })
    display_name!: LocalizedString

    @Column({ type: 'varchar', length: 7, default: '#9e9e9e' })
    color!: string

    @Column({ type: 'boolean', name: 'has_global_access', default: false })
    has_global_access!: boolean

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
