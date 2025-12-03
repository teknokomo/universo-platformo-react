import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

// Comments in English only
@Entity({ name: 'containers', schema: 'storages' })
export class Container {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
