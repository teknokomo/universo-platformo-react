import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    VersionColumn,
    ManyToOne,
    OneToMany,
    JoinColumn
} from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Application } from './Application'
import { ConnectorPublication } from './ConnectorPublication'

/**
 * Connector entity - represents a data connector within an Application
 *
 * Connectors define connections to Publications (external interfaces of Metahubs).
 * Each Connector can be linked to one or more Publications via the ConnectorPublication junction table.
 *
 * Publication association constraints (orthogonal flags):
 * - isSingleMetahub: controls maximum (true = max 1 publication, false = unlimited)
 * - isRequiredMetahub: controls minimum (true = min 1 publication required, false = can have 0)
 */
@Entity({ name: 'connectors', schema: 'applications' })
export class Connector {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'application_id' })
    applicationId!: string

    @ManyToOne(() => Application, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'application_id' })
    application!: Application

    /** Localized name */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    // ═══════════════════════════════════════════════════════════════════════
    // Publication constraint flags
    // ═══════════════════════════════════════════════════════════════════════

    /** If true, connector can only be associated with one publication (max constraint) */
    @Column({ type: 'boolean', name: 'is_single_metahub', default: true })
    isSingleMetahub!: boolean

    /** If true, connector must have at least one publication association (min constraint) */
    @Column({ type: 'boolean', name: 'is_required_metahub', default: true })
    isRequiredMetahub!: boolean

    /** Junction table relationships to Publications */
    @OneToMany(() => ConnectorPublication, (connectorPublication) => connectorPublication.connector)
    connectorPublications!: ConnectorPublication[]

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

    // Access control
    @Column({ name: '_app_owner_id', type: 'uuid', nullable: true })
    _appOwnerId?: string

    @Column({ name: '_app_access_level', type: 'varchar', length: 20, default: 'private' })
    _appAccessLevel!: string
}
