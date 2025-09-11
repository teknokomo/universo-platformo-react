import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'

@Entity({ name: 'entity_template' })
export class EntityTemplate {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ unique: true })
    code!: string

    @Column({ name: 'title_en' })
    titleEn!: string

    @Column({ name: 'title_ru' })
    titleRu!: string

    @Column({ name: 'description_en', type: 'text', nullable: true })
    descriptionEn?: string

    @Column({ name: 'description_ru', type: 'text', nullable: true })
    descriptionRu?: string


    @ManyToOne(() => EntityTemplate, { nullable: true })
    @JoinColumn({ name: 'parent_template_id' })
    parentTemplate?: EntityTemplate | null

    @Column({ name: 'resource_schema', type: 'jsonb', default: {} })
    resourceSchema!: Record<string, any>
}
