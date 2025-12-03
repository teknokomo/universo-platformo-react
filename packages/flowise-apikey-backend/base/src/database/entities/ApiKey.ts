import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import type { Unik } from '@universo/uniks-backend'

/**
 * Interface for API Key entity
 */
export interface IApiKey {
    id: string
    keyName: string
    apiKey: string
    apiSecret: string
    updatedDate: Date
}

/**
 * API Key entity for database storage mode
 */
@Entity('apikey')
export class ApiKey implements IApiKey {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'text' })
    apiKey!: string

    @Column({ type: 'text' })
    apiSecret!: string

    @Column({ type: 'text' })
    keyName!: string

    @UpdateDateColumn()
    updatedDate!: Date

    // Universo Platformo | Unik relation
    @ManyToOne('Unik', { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik
}
