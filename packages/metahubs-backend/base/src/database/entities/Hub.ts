import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Metahub } from './Metahub'

/**
 * Hub entity - represents a virtual table within a Metahub
 *
 * Analogous to a "Catalog" or "Document" in 1C:Enterprise.
 * Contains Attributes (field definitions) and Records (actual data).
 */
@Entity({ name: 'hubs', schema: 'metahubs' })
export class Hub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'metahub_id' })
    metahubId!: string

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub

    /** Localized name */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** System identifier for API access (e.g., "ideas", "products") */
    @Column({ type: 'varchar', length: 100 })
    codename!: string

    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
