import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Unik } from './Unik'

@Entity({ name: 'uniks_users', schema: 'uniks' })
export class UnikUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    unik_id!: string

    @Column('uuid')
    user_id!: string

    @Column({ type: 'varchar', length: 50, default: 'owner' })
    role!: string

    @Column({ type: 'text', nullable: true })
    comment?: string

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at!: Date

    @ManyToOne(() => Unik, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik
}
