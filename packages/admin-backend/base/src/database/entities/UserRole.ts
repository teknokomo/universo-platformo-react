import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Role } from './Role'

/**
 * UserRole entity for user-to-role assignments
 * Stored in admin.user_roles table
 *
 * Note: user_id and granted_by reference auth.users (Supabase managed)
 * Use AuthUser entity for separate queries - no direct TypeORM relations
 */
@Entity({ name: 'user_roles', schema: 'admin' })
@Unique(['user_id', 'role_id'])
export class UserRole {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    user_id!: string

    @Column('uuid')
    role_id!: string

    @Column({ type: 'uuid', nullable: true })
    granted_by?: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @ManyToOne(() => Role, (role) => role.user_roles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role!: Role
}
