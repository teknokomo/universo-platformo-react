/**
 * ChatMessageFeedback Entity
 */
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm'
import { IChatMessageFeedback, ChatMessageRatingType } from '../../Interface'

@Entity('chat_message_feedback')
export class ChatMessageFeedback implements IChatMessageFeedback {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column({ name: 'canvas_id', type: 'uuid' })
    canvasId: string

    @Column()
    chatId: string

    @Column({ unique: true })
    messageId: string

    @Column()
    rating: ChatMessageRatingType

    @Column({ type: 'text', nullable: true })
    content?: string

    @CreateDateColumn()
    createdDate: Date
}
