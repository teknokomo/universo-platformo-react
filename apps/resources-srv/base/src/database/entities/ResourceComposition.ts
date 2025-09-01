import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm'
import { Resource } from './Resource'

@Entity({ name: 'resource_composition' })
export class ResourceComposition {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'parent_resource_id' })
    parentResource!: Resource

    @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'child_resource_id' })
    childResource!: Resource

    @Column('int')
    quantity!: number

    @Column({ name: 'sort_order', type: 'int' })
    sortOrder!: number

    @Column({ name: 'is_required', type: 'boolean', default: false })
    isRequired!: boolean

    @Column({ type: 'jsonb', default: {} })
    config!: Record<string, any>
}
