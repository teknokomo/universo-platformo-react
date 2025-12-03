import { Entity as ORMEntity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

// Comments in English only
@ORMEntity({ name: 'positions', schema: 'organizations' })
export class Position {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any>

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
