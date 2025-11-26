import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Unik } from '@universo/uniks-srv'

/**
 * Tool entity for custom tools in Universo Platformo
 * Migrated from packages/flowise-server/src/database/entities/Tool.ts
 */
@Entity('tool')
export class Tool {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column({ type: 'text' })
    description: string

    @Column()
    color: string

    @Column({ nullable: true })
    iconSrc?: string

    @Column({ nullable: true, type: 'text' })
    schema?: string

    @Column({ nullable: true, type: 'text' })
    func?: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date

    @ManyToOne(() => Unik, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik: Unik
}
