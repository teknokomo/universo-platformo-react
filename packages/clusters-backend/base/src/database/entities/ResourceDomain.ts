import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Resource } from './Resource'
import { Domain } from './Domain'

// Comments in English only
@Entity({ name: 'resources_domains', schema: 'clusters' })
export class ResourceDomain {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id' })
    resource!: Resource

    @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'domain_id' })
    domain!: Domain

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
