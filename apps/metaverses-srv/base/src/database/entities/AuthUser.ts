import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'users', schema: 'auth' })
export class AuthUser {
    @PrimaryColumn('uuid')
    id!: string

    @Column({ type: 'text', nullable: true })
    email!: string | null
}
