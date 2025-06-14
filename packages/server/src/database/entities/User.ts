import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'users' })
export class User {
    @PrimaryColumn('uuid')
    id: string // Universo Platformo | For Supabase this is the ID from up-auth.users; local users get a UUID

    @Column()
    email: string

    @Column({ nullable: true })
    password_hash?: string // Universo Platformo | Password hash (null for Supabase users)

    @Column({ default: false })
    is_super_admin: boolean

    @Column({ default: false })
    is_banned: boolean
}
