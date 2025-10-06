import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column } from 'typeorm'
import { Resource } from './Resource'
import { Cluster } from './Cluster'

// Comments in English only
@Entity({ name: 'resources_clusters', schema: 'resources' })
export class ResourceCluster {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id' })
    resource!: Resource

    @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cluster_id' })
    cluster!: Cluster

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
