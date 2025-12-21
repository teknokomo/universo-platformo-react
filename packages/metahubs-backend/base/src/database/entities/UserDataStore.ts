import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { SysEntity } from './SysEntity'

/**
 * UserDataStore - JSONB storage for user-defined entity records
 *
 * This is the universal storage table for all metadata-defined entities.
 * The actual field values are stored in the `data` JSONB column.
 */
@Entity({ name: 'user_data_store', schema: 'metahubs' })
export class UserDataStore {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'entity_id', type: 'uuid' })
    entity_id!: string

    @Column({ type: 'jsonb', default: {} })
    data!: Record<string, unknown>

    @Column({ name: 'created_by', type: 'uuid', nullable: true })
    createdBy?: string

    @Column({ name: 'updated_by', type: 'uuid', nullable: true })
    updatedBy?: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => SysEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'entity_id' })
    entity?: SysEntity
}
