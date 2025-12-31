import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm'
import type { ILead } from '../../Interface'

/**
 * Lead entity for contact information captured during chat interactions
 * Extracted from packages/flowise-core-backend/base/src/database/entities/Lead.ts
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

    @Column({ name: 'canvas_id', nullable: true })
    canvasId?: string

    @Column()
    chatId!: string

    // Consent tracking fields - added for Terms of Service and Privacy Policy acceptance
    @Index('idx_lead_terms_accepted')
    @Column({ type: 'boolean', default: false })
    terms_accepted!: boolean

    @Column({ type: 'timestamptz', nullable: true })
    terms_accepted_at?: Date

    @Index('idx_lead_privacy_accepted')
    @Column({ type: 'boolean', default: false })
    privacy_accepted!: boolean

    @Column({ type: 'timestamptz', nullable: true })
    privacy_accepted_at?: Date

    @Column({ type: 'varchar', length: 50, nullable: true })
    terms_version?: string

    @Column({ type: 'varchar', length: 50, nullable: true })
    privacy_version?: string

    @CreateDateColumn()
    createdDate!: Date
}
