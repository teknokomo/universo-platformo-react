import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Section } from './Section'
import { Metaverse } from './Metaverse'

// Comments in English only
@Entity({ name: 'sections_metaverses', schema: 'entities' })
export class SectionMetaverse {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Section, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'section_id' })
    section!: Section

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metaverse_id' })
    metaverse!: Metaverse

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
