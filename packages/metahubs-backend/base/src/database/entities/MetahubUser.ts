import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm'
import { Metahub } from './Metahub'

@Entity({ name: 'metahubs_users', schema: 'metahubs' })
export class MetahubUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahubId!: string

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string

    @Column({ name: 'active_branch_id', type: 'uuid', nullable: true })
    activeBranchId?: string | null

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    // ═══════════════════════════════════════════════════════════════════════════
    // Platform-level system fields (_upl_*)
    // ═══════════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: '_upl_created_at', type: 'timestamptz' })
    _uplCreatedAt!: Date

    @Column({ name: '_upl_created_by', type: 'uuid', nullable: true })
    _uplCreatedBy?: string

    @UpdateDateColumn({ name: '_upl_updated_at', type: 'timestamptz' })
    _uplUpdatedAt!: Date

    @Column({ name: '_upl_updated_by', type: 'uuid', nullable: true })
    _uplUpdatedBy?: string

    @VersionColumn({ name: '_upl_version' })
    _uplVersion!: number

    // Archive fields
    @Column({ name: '_upl_archived', type: 'boolean', default: false })
    _uplArchived!: boolean

    @Column({ name: '_upl_archived_at', type: 'timestamptz', nullable: true })
    _uplArchivedAt?: Date

    @Column({ name: '_upl_archived_by', type: 'uuid', nullable: true })
    _uplArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_upl_deleted', type: 'boolean', default: false })
    _uplDeleted!: boolean

    @Column({ name: '_upl_deleted_at', type: 'timestamptz', nullable: true })
    _uplDeletedAt?: Date

    @Column({ name: '_upl_deleted_by', type: 'uuid', nullable: true })
    _uplDeletedBy?: string

    @Column({ name: '_upl_purge_after', type: 'timestamptz', nullable: true })
    _uplPurgeAfter?: Date

    // Lock fields
    @Column({ name: '_upl_locked', type: 'boolean', default: false })
    _uplLocked!: boolean

    @Column({ name: '_upl_locked_at', type: 'timestamptz', nullable: true })
    _uplLockedAt?: Date

    @Column({ name: '_upl_locked_by', type: 'uuid', nullable: true })
    _uplLockedBy?: string

    @Column({ name: '_upl_locked_reason', type: 'text', nullable: true })
    _uplLockedReason?: string

    // ═══════════════════════════════════════════════════════════════════════════
    // Metahub-level system fields (_mhb_*)
    // ═══════════════════════════════════════════════════════════════════════════

    // Publication fields
    @Column({ name: '_mhb_published', type: 'boolean', default: false })
    _mhbPublished!: boolean

    @Column({ name: '_mhb_published_at', type: 'timestamptz', nullable: true })
    _mhbPublishedAt?: Date

    @Column({ name: '_mhb_published_by', type: 'uuid', nullable: true })
    _mhbPublishedBy?: string

    // Archive fields
    @Column({ name: '_mhb_archived', type: 'boolean', default: false })
    _mhbArchived!: boolean

    @Column({ name: '_mhb_archived_at', type: 'timestamptz', nullable: true })
    _mhbArchivedAt?: Date

    @Column({ name: '_mhb_archived_by', type: 'uuid', nullable: true })
    _mhbArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_mhb_deleted', type: 'boolean', default: false })
    _mhbDeleted!: boolean

    @Column({ name: '_mhb_deleted_at', type: 'timestamptz', nullable: true })
    _mhbDeletedAt?: Date

    @Column({ name: '_mhb_deleted_by', type: 'uuid', nullable: true })
    _mhbDeletedBy?: string

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub
}
