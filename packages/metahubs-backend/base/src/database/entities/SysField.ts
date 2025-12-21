import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { SysEntity } from './SysEntity'

/**
 * SysField - Field definition for a SysEntity
 *
 * Defines the schema of fields for a user-defined entity.
 * Supported field types: string, number, boolean, date, datetime,
 * text, select, multiselect, reference (FK to another SysEntity).
 */
@Entity({ name: 'sys_fields', schema: 'metahubs' })
export class SysField {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'entity_id', type: 'uuid' })
    entity_id!: string

    @Column({ length: 255 })
    name!: string

    @Column({ length: 100 })
    codename!: string

    @Column({ length: 50, name: 'field_type' })
    fieldType!: string

    @Column({ type: 'boolean', default: false })
    required!: boolean

    @Column({ type: 'jsonb', nullable: true, name: 'field_config' })
    fieldConfig?: Record<string, unknown>

    @Column({ type: 'int', default: 0, name: 'sort_order' })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => SysEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'entity_id' })
    entity?: SysEntity
}
