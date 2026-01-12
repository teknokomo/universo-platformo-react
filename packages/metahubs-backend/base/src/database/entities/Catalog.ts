import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
import type { VersionedLocalizedContent } from '@universo/types'
import { Metahub } from './Metahub'
import { CatalogHub } from './CatalogHub'

/**
 * Catalog entity - represents a directory/reference within a Metahub
 *
 * Analogous to "Справочник" (Catalog/Reference) in 1C:Enterprise.
 * Contains Attributes (field definitions) and Records (actual data entries).
 *
 * Each Catalog belongs to a Metahub (metahub_id is required for ownership).
 * Catalogs can be associated with multiple Hubs via the CatalogHub junction table.
 *
 * Hub association constraints (orthogonal flags):
 * - isSingleHub: controls maximum (true = max 1 hub, false = unlimited)
 * - isRequiredHub: controls minimum (true = min 1 hub required, false = can have 0 hubs)
 */
@Entity({ name: 'catalogs', schema: 'metahubs' })
export class Catalog {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'metahub_id' })
    metahubId!: string

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub

    /** If true, catalog can only be associated with one hub (max constraint) */
    @Column({ type: 'boolean', name: 'is_single_hub', default: false })
    isSingleHub!: boolean

    /** If true, catalog must have at least one hub association (min constraint) */
    @Column({ type: 'boolean', name: 'is_required_hub', default: false })
    isRequiredHub!: boolean

    /** Localized name */
    @Column({ type: 'jsonb', default: {} })
    name!: VersionedLocalizedContent<string>

    /** Localized description */
    @Column({ type: 'jsonb', nullable: true })
    description?: VersionedLocalizedContent<string>

    /** System identifier for API access (e.g., "products", "categories") */
    @Column({ type: 'varchar', length: 100 })
    codename!: string

    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    /** Junction table relationships to Hubs */
    @OneToMany(() => CatalogHub, (catalogHub) => catalogHub.catalog)
    catalogHubs!: CatalogHub[]
}
