import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { Entity as CoreEntity } from './Entity'

@Entity({ name: 'entity_relation' })
export class EntityRelation {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => CoreEntity, { nullable: false })
    @JoinColumn({ name: 'source_entity_id' })
    sourceEntity!: CoreEntity

    @ManyToOne(() => CoreEntity, { nullable: false })
    @JoinColumn({ name: 'target_entity_id' })
    targetEntity!: CoreEntity

    @Column({ name: 'relation_type' })
    relationType!: string
}
