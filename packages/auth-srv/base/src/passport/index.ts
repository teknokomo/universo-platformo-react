import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { createClient } from '@supabase/supabase-js'

// Universo Platformo | Passport Local Strategy using Supabase as IdP
passport.use(
    new LocalStrategy(
        { usernameField: 'email', passwordField: 'password', session: true },
        async (email: string, password: string, done: (error: unknown, user?: any, info?: any) => void) => {
            try {
                // Create a per-request client without persistence
                const supa = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
                    auth: { persistSession: false }
                })
                const { data, error } = await supa.auth.signInWithPassword({ email, password })
                if (error || !data?.session || !data?.user) return done(null, false, { message: 'Invalid credentials' })

                const access = data.session.access_token
                const refresh = data.session.refresh_token
                const payload = JSON.parse(Buffer.from(access.split('.')[1], 'base64').toString())
                const exp = typeof payload?.exp === 'number' ? payload.exp : 0

                const user = { id: data.user.id, email: data.user.email ?? '' }
                // Pass tokens via third argument (cast to any to extend)
                return (done as any)(null, user, { tokens: { access, refresh, exp } })
            } catch (e) {
                return done(e)
            }
        }
    )
)

passport.serializeUser((user: any, done: (error: unknown, id?: any) => void) => done(null, { id: user.id, email: user.email }))
passport.deserializeUser((obj: any, done: (error: unknown, user?: any) => void) => done(null, obj))

export default passport
