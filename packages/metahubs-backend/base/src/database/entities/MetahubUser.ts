import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Metahub } from './Metahub'

/**
 * MetahubUser - Membership table linking users to metahubs
 *
 * Roles:
 * - owner: Full control, can delete metahub
 * - admin: Can manage entities/fields/records, invite users
 * - editor: Can create/edit records
 * - viewer: Read-only access
 */
@Entity({ name: 'metahubs_users', schema: 'metahubs' })
export class MetahubUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahub_id!: string

    @Column({ name: 'user_id', type: 'uuid' })
    user_id!: string

    @Column({ length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub?: Metahub
}
