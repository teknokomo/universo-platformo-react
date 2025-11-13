import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Domain } from './Domain'
import { Cluster } from './Cluster'

// Comments in English only
@Entity({ name: 'domains_clusters', schema: 'clusters' })
export class DomainCluster {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'domain_id' })
    domain!: Domain

    @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cluster_id' })
    cluster!: Cluster

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
