import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Container } from './Container'
import { Storage } from './Storage'

// Comments in English only
@Entity({ name: 'containers_storages', schema: 'storages' })
export class ContainerStorage {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Container, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'container_id' })
    container!: Container

    @ManyToOne(() => Storage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storage_id' })
    storage!: Storage

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
