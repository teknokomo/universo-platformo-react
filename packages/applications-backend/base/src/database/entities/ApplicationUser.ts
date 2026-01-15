import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Application } from './Application'

@Entity({ name: 'applications_users', schema: 'applications' })
export class ApplicationUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    application_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn()
    created_at!: Date

    @ManyToOne(() => Application, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'application_id' })
    application!: Application
}
