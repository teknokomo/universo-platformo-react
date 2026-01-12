import {
    Entity as ORMEntity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm'
import { Catalog } from './Catalog'

/**
 * HubRecord entity - represents a data row within a Catalog
 *
 * The `data` column stores dynamic field values as JSONB.
 * Keys correspond to Attribute.codename values.
 *
 * Example:
 * If a Catalog "Products" has attributes "name", "price", "inStock":
 * {
 *   "name": "Laptop",
 *   "price": 999.99,
 *   "inStock": true
 * }
 *
 * Named "HubRecord" to avoid conflict with built-in TypeScript "Record" type.
 * Database table name remains "records".
 */
@ORMEntity({ name: 'records', schema: 'metahubs' })
@Index('idx_records_data_gin', { synchronize: false }) // GIN index created in migration
export class HubRecord {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'uuid', name: 'catalog_id' })
    catalogId!: string

    @ManyToOne(() => Catalog, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'catalog_id' })
    catalog!: Catalog

    /**
     * Dynamic data storage.
     * Keys are Attribute.codename, values match Attribute.dataType
     */
    @Column({ type: 'jsonb', default: {} })
    data!: Record<string, unknown>

    /**
     * Owner user for RLS (optional, for future multi-user records)
     */
    @Column({ type: 'uuid', nullable: true, name: 'owner_id' })
    ownerId?: string

    @Column({ type: 'integer', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
