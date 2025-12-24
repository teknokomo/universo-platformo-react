import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Metahub } from './Metahub'

@Entity({ name: 'metahubs_users', schema: 'metahubs' })
export class MetahubUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    metahub_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Metahub, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'metahub_id' })
    metahub!: Metahub
}
