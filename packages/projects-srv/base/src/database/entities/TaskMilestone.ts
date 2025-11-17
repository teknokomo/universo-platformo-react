import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Task } from './Task'
import { Milestone } from './Milestone'

// Comments in English only
@Entity({ name: 'tasks_milestones', schema: 'projects' })
export class TaskMilestone {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task!: Task

    @ManyToOne(() => Milestone, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'milestone_id' })
    milestone!: Milestone

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
