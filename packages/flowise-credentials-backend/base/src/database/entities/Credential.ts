import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Unik } from '@universo/uniks-backend'

/**
 * Credential entity for external service authentication in Universo Platformo
 * Migrated from packages/flowise-core-backend/base/src/database/entities/Credential.ts
 */
@Entity('credential')
export class Credential {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    name: string

    @Column()
    credentialName: string

    @Column({ type: 'text' })
    encryptedData: string

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
