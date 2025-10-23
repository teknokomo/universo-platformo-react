import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { Unik } from './Unik'

// Membership entity: represents user membership in a Unik (workspace)
// Matches migration: uniks.uniks_users (id PK, unique (user_id, unik_id))
@Unique('UQ_uniks_users_user_unik', ['user_id', 'unik_id'])
@Entity({ name: 'uniks_users', schema: 'uniks' })
export class UnikUser {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column('uuid')
    user_id!: string

    @Column('uuid')
    unik_id!: string

    @Column({ default: 'member' })
    role!: string

    @ManyToOne(() => Unik, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unik_id' })
    unik!: Unik
}
