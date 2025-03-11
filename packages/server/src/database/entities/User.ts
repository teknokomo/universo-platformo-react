import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity({ name: 'users' })
export class User {
    @PrimaryColumn('uuid')
    id: string // Для Supabase это будет ID из up-auth.users, для локальных пользователей генерируем UUID

    @Column()
    email: string

    @Column({ nullable: true })
    password_hash?: string // Хеш пароля (null для пользователей Supabase)

    @Column({ default: false })
    is_super_admin: boolean

    @Column({ default: false })
    is_banned: boolean
}
