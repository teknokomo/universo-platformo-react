import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn, OneToOne, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { TemplateVersion } from './TemplateVersion'

/**
 * Template entity — represents a metahub template in the template catalog.
 *
 * Templates are platform-level entities (no _mhb_* fields).
 * System templates (is_system=true) are seeded at startup and cannot be deleted by users.
 */
@Entity({ name: 'templates', schema: 'metahubs' })
export class Template {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    /** Unique codename for internal references (e.g., "basic", "crm") */
    @Column({ type: 'varchar', length: 100 })
    codename!: string

    /** Localized name using VLC pattern */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** MUI icon name (e.g., "Dashboard") */
    @Column({ type: 'varchar', length: 50, nullable: true })
    icon?: string | null

    /** System templates are seeded at startup and cannot be deleted by users */
    @Column({ name: 'is_system', type: 'boolean', default: false })
    isSystem!: boolean

    /** Soft enable/disable without deletion */
    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive!: boolean

    /** Display order in template picker */
    @Column({ name: 'sort_order', type: 'integer', default: 0 })
    sortOrder!: number

    /** Currently active version — set after TemplateVersion insert */
    @Column({ name: 'active_version_id', type: 'uuid', nullable: true })
    activeVersionId?: string | null

    @OneToOne(() => TemplateVersion, { nullable: true, eager: false })
    @JoinColumn({ name: 'active_version_id' })
    activeVersion?: TemplateVersion | null

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
}
