import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Application } from './Application'

@Entity({ name: 'applications_users', schema: 'applications' })
export class ApplicationUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'application_id', type: 'uuid' })
    applicationId!: string

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'jsonb', nullable: true })
    comment?: VersionedLocalizedContent<string> | null

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
    // Application-level system fields (_app_*)
    // ═══════════════════════════════════════════════════════════════════════════

    // Publication fields
    @Column({ name: '_app_published', type: 'boolean', default: true })
    _appPublished!: boolean

    @Column({ name: '_app_published_at', type: 'timestamptz', nullable: true })
    _appPublishedAt?: Date

    @Column({ name: '_app_published_by', type: 'uuid', nullable: true })
    _appPublishedBy?: string

    // Archive fields
    @Column({ name: '_app_archived', type: 'boolean', default: false })
    _appArchived!: boolean

    @Column({ name: '_app_archived_at', type: 'timestamptz', nullable: true })
    _appArchivedAt?: Date

    @Column({ name: '_app_archived_by', type: 'uuid', nullable: true })
    _appArchivedBy?: string

    // Soft delete fields
    @Column({ name: '_app_deleted', type: 'boolean', default: false })
    _appDeleted!: boolean

    @Column({ name: '_app_deleted_at', type: 'timestamptz', nullable: true })
    _appDeletedAt?: Date

    @Column({ name: '_app_deleted_by', type: 'uuid', nullable: true })
    _appDeletedBy?: string

    @ManyToOne(() => Application, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'application_id' })
    application!: Application
}
