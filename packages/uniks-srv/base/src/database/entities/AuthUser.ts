import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Read-only entity for auth.users table
 * Used to fetch user email for member lists
 * DO NOT use @ManyToOne relations - use separate queries instead
 */
@Entity({ name: 'users', schema: 'auth' })
export class AuthUser {
    @PrimaryColumn('uuid')
    id!: string

    @Column({ type: 'text', nullable: true })
    email!: string | null
}
