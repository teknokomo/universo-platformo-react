import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Metaverse } from './Metaverse'

@Entity({ name: 'user_metaverses' }) // Uses public schema by default
@Unique('UQ_user_metaverses_user_mv', ['user_id', 'metaverse_id'])
export class UserMetaverse {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    user_id!: string

    @Column('uuid')
    metaverse_id!: string

    @Column({ default: 'owner' })
    role!: string

    @Column({ default: false })
    is_default!: boolean

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metaverse_id' })
    metaverse!: Metaverse
}
