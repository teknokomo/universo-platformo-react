import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column } from 'typeorm'
import { Catalog } from './Catalog'
import { Hub } from './Hub'

/**
 * CatalogHub - Junction table for Many-to-Many relationship between Catalogs and Hubs
 *
 * Allows a Catalog to be associated with multiple Hubs (like 1C:Enterprise pattern).
 * Each catalog belongs to a Metahub (ownership) but can appear in multiple Hubs (visibility).
 */
@Entity({ name: 'catalogs_hubs', schema: 'metahubs' })
export class CatalogHub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'catalog_id' })
    catalogId!: string

    @ManyToOne(() => Catalog, (catalog) => catalog.catalogHubs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'catalog_id' })
    catalog!: Catalog

    @Column({ type: 'uuid', name: 'hub_id' })
    hubId!: string

    @ManyToOne(() => Hub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'hub_id' })
    hub!: Hub

    @Column({ name: 'sort_order', type: 'integer', default: 0 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
