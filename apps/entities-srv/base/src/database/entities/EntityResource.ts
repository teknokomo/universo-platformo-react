import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Entity as CoreEntity } from './Entity'
import { Resource } from '@universo/resources-srv'

@Entity({ name: 'entity_resource' })
export class EntityResource {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => CoreEntity, { nullable: false })
    @JoinColumn({ name: 'entity_id' })
    entity!: CoreEntity

    @ManyToOne(() => Resource, { nullable: false })
    @JoinColumn({ name: 'resource_id' })
    resource!: Resource

    @Column({ name: 'slot_code', nullable: true })
    slotCode?: string

    @Column({ type: 'int', default: 1 })
    quantity!: number

    @Column({ type: 'jsonb', default: {} })
    config!: Record<string, any>
}
