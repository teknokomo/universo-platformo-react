import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Unik } from '@universo/uniks-srv'

@Entity({ name: 'transactions' })
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    user_id!: string

    @Column('uuid')
    unik_id!: string

    @ManyToOne(() => Unik, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik

    @Column('decimal', { precision: 10, scale: 2 })
    amount!: number

    @Column({ type: 'varchar', length: 3 })
    currency!: string

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: string

    @CreateDateColumn()
    created_at!: Date
}
