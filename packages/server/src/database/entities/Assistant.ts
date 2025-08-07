/* eslint-disable */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { AssistantType, IAssistant } from '../../Interface'
import { Unik } from '@universo/uniks-srv'

@Entity('assistant')
export class Assistant implements IAssistant {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'text' })
    details: string

    @Column({ type: 'uuid' })
    credential: string

    @Column({ nullable: true })
    iconSrc?: string

    @Column({ nullable: true, type: 'text' })
    type?: AssistantType

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    // New foreign key to link assistant to Unik
    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik: Unik
}
