import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Resource } from './Resource'

@Entity({ name: 'resource_revision' })
export class ResourceRevision {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id' })
    resource!: Resource

    @Column()
    version!: number

    @Column({ type: 'jsonb' })
    data!: any

    @Column({ name: 'author_id', type: 'uuid', nullable: true })
    authorId?: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
