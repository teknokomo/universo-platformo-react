import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column } from 'typeorm'
import { Slot } from './Slot'
import { Storage } from './Storage'

// Comments in English only
@Entity({ name: 'slots_storages', schema: 'storages' })
export class SlotStorage {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Slot, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'slot_id' })
    slot!: Slot

    @ManyToOne(() => Storage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storage_id' })
    storage!: Storage

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
