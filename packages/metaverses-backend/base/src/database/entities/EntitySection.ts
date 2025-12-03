import { Entity as ORMEntity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Entity } from './Entity'
import { Section } from './Section'

// Comments in English only
@ORMEntity({ name: 'entities_sections', schema: 'metaverses' })
export class EntitySection {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'entity_id' })
    entity!: Entity

    @ManyToOne(() => Section, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'section_id' })
    section!: Section

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
