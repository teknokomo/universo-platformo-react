import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Cluster } from './Cluster'

@Entity({ name: 'clusters_users', schema: 'resources' })
export class ClusterUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    cluster_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cluster_id' })
    cluster!: Cluster
}
