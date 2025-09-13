import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Metaverse } from './Metaverse'

@Entity({ name: 'metaverses_users', schema: 'entities' })
export class MetaverseUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    metaverse_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metaverse_id' })
    metaverse!: Metaverse
}
