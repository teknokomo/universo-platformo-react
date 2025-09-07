import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Entity as CoreEntity } from './Entity'

@Entity({ name: 'entity_owner' })
export class EntityOwner {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => CoreEntity, { nullable: false })
    @JoinColumn({ name: 'entity_id' })
    entity!: CoreEntity

    @Column({ name: 'user_id' })
    userId!: string

    @Column()
    role!: string

    @Column({ name: 'is_primary', default: false })
    isPrimary!: boolean
}
