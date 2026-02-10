import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { MetahubTemplateManifest } from '@universo/types'
import { Template } from './Template'

/**
 * TemplateVersion entity — a versioned snapshot of a template manifest.
 *
 * Each version stores the full MetahubTemplateManifest JSON and its SHA-256 hash
 * for deduplication. Only one version per template can be active at a time.
 *
 * Templates are platform-level entities (no _mhb_* fields).
 */
@Entity({ name: 'templates_versions', schema: 'metahubs' })
export class TemplateVersion {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'template_id', type: 'uuid' })
    templateId!: string

    @ManyToOne(() => Template, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'template_id' })
    template!: Template

    /** Monotonic version number within the template */
    @Column({ name: 'version_number', type: 'integer' })
    versionNumber!: number

    /** SemVer label (e.g., "1.0.0") */
    @Column({ name: 'version_label', type: 'varchar', length: 20 })
    versionLabel!: string

    /** Minimum structure version required by this template version */
    @Column({ name: 'min_structure_version', type: 'integer', default: 1 })
    minStructureVersion!: number

    /** Full MetahubTemplateManifest JSON */
    @Column({ name: 'manifest_json', type: 'jsonb' })
    manifestJson!: MetahubTemplateManifest

    /** SHA-256 hash of manifest_json for deduplication */
    @Column({ name: 'manifest_hash', type: 'varchar', length: 64 })
    manifestHash!: string

    /** Whether this is the currently active version for the parent template */
    @Column({ name: 'is_active', type: 'boolean', default: false })
    isActive!: boolean

    /** Optional changelog describing changes from previous version */
    @Column({ type: 'jsonb', nullable: true })
    changelog?: Record<string, unknown> | null

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
