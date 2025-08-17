import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Check } from 'typeorm'
import { Metaverse } from './Metaverse'

@Entity({ name: 'metaverse_links' }) // Uses public schema by default
@Check('CHK_relation_type', "relation_type IN ('child','partner','location')")
export class MetaverseLink {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    src_metaverse_id!: string

    @Column('uuid')
    dst_metaverse_id!: string

    @Column()
    relation_type!: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'src_metaverse_id' })
    src_metaverse!: Metaverse

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'dst_metaverse_id' })
    dst_metaverse!: Metaverse
}
