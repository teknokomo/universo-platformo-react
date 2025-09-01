import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { ResourceCategory } from './ResourceCategory'
import { ResourceState } from './ResourceState'
import { StorageType } from './StorageType'

@Entity({ name: 'resource' })
export class Resource {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => ResourceCategory, { nullable: false })
    @JoinColumn({ name: 'category_id' })
    category!: ResourceCategory

    @ManyToOne(() => ResourceState, { nullable: false })
    @JoinColumn({ name: 'state_id' })
    state!: ResourceState

    @ManyToOne(() => StorageType, { nullable: false })
    @JoinColumn({ name: 'storage_type_id' })
    storageType!: StorageType

    @Column({ unique: true })
    slug!: string

    @Column({ name: 'title_en' })
    titleEn!: string

    @Column({ name: 'title_ru' })
    titleRu!: string

    @Column({ name: 'description_en', type: 'text', nullable: true })
    descriptionEn?: string

    @Column({ name: 'description_ru', type: 'text', nullable: true })
    descriptionRu?: string

    @Column({ type: 'jsonb', default: {} })
    metadata!: Record<string, any>

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
