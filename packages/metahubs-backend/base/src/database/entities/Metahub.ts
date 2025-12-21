import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * MetaHub - A configuration container for metadata-driven entities
 *
 * Analogous to a "Configuration" in 1C:Enterprise - contains entity definitions,
 * field schemas, and user data records.
 */
@Entity({ name: 'metahubs', schema: 'metahubs' })
export class Metahub {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ length: 255 })
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
