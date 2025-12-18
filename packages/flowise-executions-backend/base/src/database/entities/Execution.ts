import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Canvas } from '@universo/spaces-backend'

/**
 * Execution state enum
 * Migrated from Flowise 3.0.12
 */
export enum ExecutionState {
    INPROGRESS = 'INPROGRESS',
    FINISHED = 'FINISHED',
    ERROR = 'ERROR',
    TERMINATED = 'TERMINATED',
    TIMEOUT = 'TIMEOUT',
    STOPPED = 'STOPPED'
}

/**
 * Execution entity for agent flow executions
 * Adapted from Flowise 3.0.12 for Universo Platformo
 *
 * Changes from original:
 * - Renamed agentflowId → canvasId (FK to Canvas instead of ChatFlow)
 * - Added soft delete support (isDeleted, deletedDate)
 * - Removed workspaceId (using Canvas relationship for access control)
 */
@Entity('execution')
export class Execution {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text' })
    executionData!: string

    @Column({ type: 'varchar', length: 20 })
    state!: ExecutionState

    @Index()
    @Column({ name: 'canvas_id', type: 'uuid' })
    canvasId!: string

    @Index()
    @Column({ type: 'varchar', length: 255 })
    sessionId!: string

    @Column({ nullable: true, type: 'text' })
    action?: string

    @Column({ nullable: true, default: false })
    isPublic?: boolean

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate!: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate!: Date

    @Column({ nullable: true, type: 'timestamp' })
    stoppedDate?: Date

    // Soft delete support
    @Column({ name: 'is_deleted', default: false })
    isDeleted!: boolean

    @Column({ name: 'deleted_date', nullable: true, type: 'timestamp' })
    deletedDate?: Date

    @ManyToOne(() => Canvas, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'canvas_id' })
    canvas!: Canvas
}
