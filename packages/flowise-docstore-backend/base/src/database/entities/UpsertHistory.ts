import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm'
import { IUpsertHistory } from '../../Interface'

@Entity('upsert_history')
export class UpsertHistory implements IUpsertHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column({ name: 'canvas_id', type: 'uuid' })
    canvasId: string

    @Column({ type: 'text' })
    result: string

    @Column({ type: 'text' })
    flowData: string

    @CreateDateColumn()
    date: Date
}
