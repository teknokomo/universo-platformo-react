import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm'
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
 */
@Entity({ name: 'connectors_publications', schema: 'applications' })
@Unique(['connectorId', 'publicationId'])
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

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
