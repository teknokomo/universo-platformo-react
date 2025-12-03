import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Slot } from './Slot'
import { Container } from './Container'

// Comments in English only
@Entity({ name: 'slots_containers', schema: 'storages' })
export class SlotContainer {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Slot, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'slot_id' })
    slot!: Slot

    @ManyToOne(() => Container, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'container_id' })
    container!: Container

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
