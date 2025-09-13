import { Entity as ORMEntity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column } from 'typeorm'
import { Entity } from './Entity'
import { Metaverse } from './Metaverse'

// Comments in English only
@ORMEntity({ name: 'entities_metaverses', schema: 'entities' })
export class EntityMetaverse {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'entity_id' })
    entity!: Entity

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metaverse_id' })
    metaverse!: Metaverse

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
