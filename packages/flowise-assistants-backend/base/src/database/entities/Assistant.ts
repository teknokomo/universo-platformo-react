import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { AssistantType, IAssistant } from '../../Interface'
import { Unik } from '@universo/uniks-backend'

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

    // unik_id column for direct query access
    @Column({ type: 'uuid', name: 'unik_id', nullable: true })
    unik_id?: string

    // Foreign key to link assistant to Unik
    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'unik_id' })
    unik?: Unik
}
