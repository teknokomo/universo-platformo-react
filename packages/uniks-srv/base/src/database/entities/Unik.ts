import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'uniks', schema: 'uniks' })
export class Unik {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    name!: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive!: boolean

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt!: Date
}
