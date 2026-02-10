import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

@Entity({ name: 'metahubs_branches', schema: 'metahubs' })
export class MetahubBranch {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahubId!: string

    @Column({ name: 'source_branch_id', type: 'uuid', nullable: true })
    sourceBranchId?: string | null

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string> | null

    @Column({ type: 'varchar', length: 100 })
    codename!: string

    @Column({ name: 'branch_number', type: 'int' })
    branchNumber!: number

    @Column({ name: 'schema_name', type: 'varchar', length: 100 })
    schemaName!: string

    /** DDL structure version used when this branch schema was created */
    @Column({ name: 'structure_version', type: 'integer', default: 1 })
    structureVersion!: number

    // ═══════════════════════════════════════════════════════════════════════════
    // Platform-level system fields (_upl_*)
    // ═══════════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: '_upl_created_at', type: 'timestamptz' })
    _uplCreatedAt!: Date

    @Column({ name: '_upl_created_by', type: 'uuid', nullable: true })
    _uplCreatedBy?: string | null

    @UpdateDateColumn({ name: '_upl_updated_at', type: 'timestamptz' })
    _uplUpdatedAt!: Date

    @Column({ name: '_upl_updated_by', type: 'uuid', nullable: true })
    _uplUpdatedBy?: string | null

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
}
