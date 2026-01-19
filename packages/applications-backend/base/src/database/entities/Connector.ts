import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
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

    // ═══════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
