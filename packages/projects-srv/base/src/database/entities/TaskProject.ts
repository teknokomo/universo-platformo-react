import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column } from 'typeorm'
import { Task } from './Task'
import { Project } from './Project'

// Comments in English only
@Entity({ name: 'tasks_projects', schema: 'projects' })
export class TaskProject {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task!: Task

    @ManyToOne(() => Project, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Project

    @Column({ name: 'sort_order', default: 1 })
    sortOrder!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
