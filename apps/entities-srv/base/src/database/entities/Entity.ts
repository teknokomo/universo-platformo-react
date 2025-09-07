import { Entity as OrmEntity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Resource } from '@universo/resources-srv'
import { EntityTemplate } from './EntityTemplate'
import { EntityStatus } from './EntityStatus'

@OrmEntity({ name: 'entity' })
export class Entity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => EntityTemplate, { nullable: false })
    @JoinColumn({ name: 'template_id' })
    template!: EntityTemplate

    @ManyToOne(() => EntityStatus, { nullable: false })
    @JoinColumn({ name: 'status_id' })
    status!: EntityStatus

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

    @ManyToOne(() => Resource, { nullable: true })
    @JoinColumn({ name: 'root_resource_id' })
    rootResource?: Resource | null

    @ManyToOne(() => Entity, { nullable: true })
    @JoinColumn({ name: 'parent_entity_id' })
    parentEntity?: Entity | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
