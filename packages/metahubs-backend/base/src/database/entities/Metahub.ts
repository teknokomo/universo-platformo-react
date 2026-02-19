import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'

/**
 * Metahub entity - represents a configuration/module in the metadata-driven platform
 *
 * Analogous to a "Configuration" in 1C:Enterprise - contains Hubs (virtual tables)
 * and their Attributes (virtual fields) definitions.
 */
@Entity({ name: 'metahubs', schema: 'metahubs' })
export class Metahub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    /** Localized name using VLC pattern */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** Unique codename for internal references (e.g., "crm-core") */
    @Column({ type: 'varchar', length: 100 })
    codename!: string

    /**
     * URL-friendly identifier for public access (e.g., "ideas", "products").
     *
     * NOTE: Logical uniqueness for non-deleted records is enforced via a partial
     * unique index defined in migrations (`WHERE _upl_deleted = false`).
     * Do NOT add `unique: true` here or enable TypeORM `synchronize: true`,
     * otherwise TypeORM may attempt to create a full unique constraint that
     * conflicts with soft-deleted rows.
     */
    @Column({ type: 'varchar', length: 100, nullable: true })
    slug?: string

    /** Default branch for this metahub */
    @Column({ name: 'default_branch_id', type: 'uuid', nullable: true })
    defaultBranchId!: string | null

    /** Monotonic counter for branch numbers (used in schema names) */
    @Column({ name: 'last_branch_number', type: 'int', default: 0 })
    lastBranchNumber!: number

    /** Whether this metahub is publicly accessible via API */
    @Column({ type: 'boolean', default: false, name: 'is_public' })
    isPublic!: boolean

    /** Template used to create this metahub (nullable when template binding is not selected) */
    @Column({ name: 'template_id', type: 'uuid', nullable: true })
    templateId?: string | null

    /** Specific template version used at creation time */
    @Column({ name: 'template_version_id', type: 'uuid', nullable: true })
    templateVersionId?: string | null

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
