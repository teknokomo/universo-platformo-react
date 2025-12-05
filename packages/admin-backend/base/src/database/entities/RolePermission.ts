import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique
} from 'typeorm'
import { Role } from './Role'

/**
 * RolePermission entity for RBAC permission assignments
 * Stored in admin.role_permissions table
 * Supports wildcard permissions (module='*', action='*')
 */
@Entity({ name: 'role_permissions', schema: 'admin' })
@Unique(['role_id', 'module', 'action'])
export class RolePermission {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    role_id!: string

    @Column({ type: 'varchar', length: 100 })
    module!: string

    @Column({ type: 'varchar', length: 20 })
    action!: string

    @Column({ type: 'jsonb', default: {} })
    conditions!: Record<string, unknown>

    @Column({ type: 'text', array: true, default: [] })
    fields!: string[]

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @ManyToOne(() => Role, (role) => role.permissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role!: Role
}
