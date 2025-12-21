import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Metahub } from './Metahub'

/**
 * SysEntity - Metadata definition for a user-defined entity type
 *
 * Represents a "virtual table" defined via metadata. The actual data
 * is stored in UserDataStore as JSONB records.
 *
 * Example: A user creates an entity "Product" with fields like
 * name, price, category - all defined in sys_fields.
 */
@Entity({ name: 'sys_entities', schema: 'metahubs' })
export class SysEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'metahub_id', type: 'uuid' })
    metahub_id!: string

    @Column({ length: 255 })
    name!: string

    @Column({ length: 100, unique: true })
    codename!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'jsonb', nullable: true, name: 'display_config' })
    displayConfig?: Record<string, unknown>

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub?: Metahub
}
