import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Storage } from './Storage'

@Entity({ name: 'storages_users', schema: 'storages' })
export class StorageUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    storage_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Storage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storage_id' })
    storage!: Storage
}
