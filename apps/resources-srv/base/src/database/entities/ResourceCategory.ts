import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm'

@Entity({ name: 'resource_category' })
export class ResourceCategory {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ unique: true })
    slug!: string

    @ManyToOne(() => ResourceCategory, (category) => category.children, { nullable: true })
    @JoinColumn({ name: 'parent_category_id' })
    parentCategory?: ResourceCategory | null

    @OneToMany(() => ResourceCategory, (category) => category.parentCategory)
    children?: ResourceCategory[]

    @Column({ name: 'title_en' })
    titleEn!: string

    @Column({ name: 'title_ru' })
    titleRu!: string

    @Column({ name: 'description_en', type: 'text', nullable: true })
    descriptionEn?: string

    @Column({ name: 'description_ru', type: 'text', nullable: true })
    descriptionRu?: string
}
