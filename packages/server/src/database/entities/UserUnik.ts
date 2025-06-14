import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { User } from './User'
import { Unik } from './Unik'

@Entity({ name: 'user_uniks' })
export class UserUnik {
    @PrimaryColumn('uuid')
    user_id: string

    @PrimaryColumn('uuid')
    unik_id: string

    @Column({ default: 'member' })
    role: string // Universo Platformo | Role of the user within a Unik (e.g., 'member' or 'owner')

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User

    @ManyToOne(() => Unik, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'unik_id' })
    unik: Unik
}
