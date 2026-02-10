import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Publication } from './Publication'

@Entity({ name: 'publications_versions', schema: 'metahubs' })
export class PublicationVersion {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'publication_id', type: 'uuid' })
    publicationId!: string

    @Column({ name: 'branch_id', type: 'uuid', nullable: true })
    branchId!: string | null

    @ManyToOne(() => Publication, (pub) => pub.versions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'publication_id' })
    publication!: Publication

    @Column({ name: 'version_number', type: 'integer' })
    versionNumber!: number

    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    @Column({ type: 'jsonb', nullable: true, default: {} })
    description!: VersionedLocalizedContent<string> | null

    /** Full metadata tree (JSON snapshot) */
    @Column({ name: 'snapshot_json', type: 'jsonb' })
    snapshotJson!: Record<string, unknown>

    /** SHA-256 hash for deduplication */
    @Column({ name: 'snapshot_hash', type: 'varchar', length: 64 })
    snapshotHash!: string

    /** Active version used for Application sync */
    @Column({ name: 'is_active', type: 'boolean', default: false })
    isActive!: boolean

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
}
