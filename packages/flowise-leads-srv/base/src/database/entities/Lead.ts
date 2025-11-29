import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm'
import type { ILead } from '../../Interface'

/**
 * Lead entity for contact information captured during chat interactions
 * Extracted from packages/flowise-server/src/database/entities/Lead.ts
 */
@Entity()
export class Lead implements ILead {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ nullable: true })
    name?: string

    @Column({ nullable: true })
    email?: string

    @Column({ nullable: true })
    phone?: string

    @Column({ type: 'integer', default: 0, nullable: false })
    points!: number

    @Column({ name: 'canvas_id' })
    canvasId!: string

    @Column()
    chatId!: string

    @CreateDateColumn()
    createdDate!: Date
}
