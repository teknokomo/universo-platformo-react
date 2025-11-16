import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Milestone } from './Milestone'
import { Project } from './Project'

// Comments in English only
@Entity({ name: 'milestones_projects', schema: 'projects' })
export class MilestoneProject {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Milestone, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'milestone_id' })
    milestone!: Milestone

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Project

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
