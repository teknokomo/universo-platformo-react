import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Project } from './Project'

@Entity({ name: 'projects_users', schema: 'projects' })
export class ProjectUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    project_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Project
}
