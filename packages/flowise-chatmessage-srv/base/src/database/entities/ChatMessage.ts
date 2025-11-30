/**
 * ChatMessage Entity
 */
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm'
import { IChatMessage, MessageType } from '../../Interface'

@Entity('chat_message')
export class ChatMessage implements IChatMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    role: MessageType

    @Index()
    @Column({ name: 'canvas_id', type: 'uuid' })
    canvasId: string

    @Column({ type: 'text' })
    content: string

    @Column({ type: 'text', nullable: true })
    sourceDocuments?: string

    @Column({ type: 'text', nullable: true })
    usedTools?: string

    @Column({ type: 'text', nullable: true })
    fileAnnotations?: string

    @Column({ type: 'text', nullable: true })
    agentReasoning?: string

    @Column({ type: 'text', nullable: true })
    fileUploads?: string

    @Column({ type: 'text', nullable: true })
    artifacts?: string

    @Column({ type: 'text', nullable: true })
    action?: string | null

    @Column({ nullable: true })
    chatType: string

    @Column({ nullable: true })
    chatId: string

    @Column({ nullable: true })
    memoryType?: string

    @Column({ nullable: true })
    sessionId?: string

    @Column({ type: 'text', nullable: true })
    leadEmail?: string

    @Column({ type: 'text', nullable: true })
    followUpPrompts?: string

    @CreateDateColumn()
    createdDate: Date
}
