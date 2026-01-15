import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Connector } from './Connector'

/**
 * ConnectorMetahub entity - junction table linking Connectors to Metahubs
 *
 * This entity represents the many-to-many relationship between Connectors
 * (in the applications schema) and Metahubs (in the metahubs schema).
 *
 * The metahubId references metahubs.metahubs.id via a cross-schema FK defined
 * in the migration (since TypeORM doesn't support cross-schema relations directly).
 *
 * Constraint behavior:
 * - Connector.isSingleMetahub = true → only one ConnectorMetahub per connector allowed
 * - Connector.isRequiredMetahub = true → at least one ConnectorMetahub per connector required
 */
@Entity({ name: 'connectors_metahubs', schema: 'applications' })
@Unique(['connectorId', 'metahubId'])
export class ConnectorMetahub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'connector_id' })
    connectorId!: string

    @ManyToOne(() => Connector, (connector) => connector.connectorMetahubs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'connector_id' })
    connector!: Connector

    /**
     * Reference to Metahub (cross-schema)
     * FK constraint is defined in migration: REFERENCES metahubs.metahubs(id)
     * TypeORM doesn't support cross-schema ManyToOne, so we store raw UUID
     */
    @Column({ type: 'uuid', name: 'metahub_id' })
    metahubId!: string

    /** Sort order for multiple metahubs per connector (when isSingleMetahub = false) */
    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
