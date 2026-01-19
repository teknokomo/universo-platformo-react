import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Application } from './Application'
import { ConnectorMetahub } from './ConnectorMetahub'

/**
 * Connector entity - represents a data connector within an Application
 *
 * Connectors define connections to Metahubs (data providers/configurations).
 * Each Connector can be linked to one or more Metahubs via the ConnectorMetahub junction table.
 *
 * Metahub association constraints (orthogonal flags):
 * - isSingleMetahub: controls maximum (true = max 1 metahub, false = unlimited)
 * - isRequiredMetahub: controls minimum (true = min 1 metahub required, false = can have 0)
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
    // Metahub constraint flags
    // ═══════════════════════════════════════════════════════════════════════

    /** If true, connector can only be associated with one metahub (max constraint) */
    @Column({ type: 'boolean', name: 'is_single_metahub', default: true })
    isSingleMetahub!: boolean

    /** If true, connector must have at least one metahub association (min constraint) */
    @Column({ type: 'boolean', name: 'is_required_metahub', default: true })
    isRequiredMetahub!: boolean

    /** Junction table relationships to Metahubs */
    @OneToMany(() => ConnectorMetahub, (connectorMetahub) => connectorMetahub.connector)
    connectorMetahubs!: ConnectorMetahub[]

    // ═══════════════════════════════════════════════════════════════════════

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
