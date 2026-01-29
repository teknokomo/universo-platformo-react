import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Connector } from './Connector'

/**
 * ConnectorPublication entity - junction table linking Connectors to Publications
 *
 * This entity represents the many-to-many relationship between Connectors
 * (in the applications schema) and Publications (in the metahubs schema).
 *
 * Publications are the external interface of Metahubs - they define which
 * Metahub data is available for syncing to Application schemas.
 *
 * The publicationId references metahubs.publications.id via a cross-schema FK
 * defined in the migration (since TypeORM doesn't support cross-schema relations directly).
 *
 * Constraint behavior:
 * - Connector.isSingleMetahub = true → only one ConnectorPublication per connector allowed
 * - Connector.isRequiredMetahub = true → at least one ConnectorPublication per connector required
 *
 * Uniqueness / indexing:
 * - Composite uniqueness (connector_id + publication_id) is enforced via a partial UNIQUE INDEX
 *   defined in the PostgreSQL migration with `WHERE _upl_deleted = false`.
 * - TypeORM decorators do not support partial indexes, so this entity intentionally omits @Unique.
 * - Do NOT rely on TypeORM schema synchronization to recreate this index; always run migrations.
 */
@Entity({ name: 'connectors_publications', schema: 'applications' })
export class ConnectorPublication {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'connector_id' })
    connectorId!: string

    @ManyToOne(() => Connector, (connector) => connector.connectorPublications, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'connector_id' })
    connector!: Connector

    /**
     * Reference to Publication (cross-schema)
     * FK constraint is defined in migration: REFERENCES metahubs.publications(id)
     * TypeORM doesn't support cross-schema ManyToOne, so we store raw UUID
     */
    @Column({ type: 'uuid', name: 'publication_id' })
    publicationId!: string

    /** Sort order for multiple publications per connector (when isSingleMetahub = false) */
    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

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

    // Soft delete fields
    @Column({ name: '_upl_deleted', type: 'boolean', default: false })
    _uplDeleted!: boolean

    @Column({ name: '_upl_deleted_at', type: 'timestamptz', nullable: true })
    _uplDeletedAt?: Date

    @Column({ name: '_upl_deleted_by', type: 'uuid', nullable: true })
    _uplDeletedBy?: string

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
}
