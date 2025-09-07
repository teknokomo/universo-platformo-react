/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm'
import { ChatflowType, IChatFlow } from '../../Interface'
import type { Unik } from '@universo/uniks-srv'

@Entity('canvases') // Refactored: ChatFlow now maps to canvases table (represents Canvas)
export class ChatFlow implements IChatFlow {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ type: 'text' })
    flowData: string

    @Column({ nullable: true })
    deployed?: boolean

    @Column({ nullable: true })
    isPublic?: boolean

    @Column({ nullable: true })
    apikeyid?: string

    @Column({ nullable: true, type: 'text' })
    chatbotConfig?: string

    @Column({ nullable: true, type: 'text' })
    apiConfig?: string

    @Column({ nullable: true, type: 'text' })
    analytic?: string

    @Column({ nullable: true, type: 'text' })
    speechToText?: string

    @Column({ nullable: true, type: 'text' })
    followUpPrompts?: string

    @Column({ nullable: true, type: 'text' })
    category?: string

    @Column({ nullable: true, type: 'text' })
    type?: ChatflowType

    // Map to snake_case column created_date in the canvases table
    // Using only name mapping avoids RDBMS-specific type coupling
    @CreateDateColumn({ name: 'created_date' })
    createdDate: Date

    // Map to snake_case column updated_date in the canvases table
    @UpdateDateColumn({ name: 'updated_date' })
    updatedDate: Date

    // NOTE: transient bridge property; not persisted on the canvases table
    // It remains for compatibility with upper layers while services migrate to Spaces joins
    unik?: Unik
}
