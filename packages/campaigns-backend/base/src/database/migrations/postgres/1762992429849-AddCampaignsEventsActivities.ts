import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCampaignsEventsActivities1762992429849 implements MigrationInterface {
    name = 'AddCampaignsEventsActivities1762992429849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Core tables: campaigns, events, activities
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS campaigns;`)

        // Core tables in campaigns schema
        await queryRunner.query(`
            CREATE TABLE campaigns.campaigns (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE campaigns.events (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE campaigns.activities (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 2) User-campaign relationship table (campaign-centric naming)
        await queryRunner.query(`
            CREATE TABLE campaigns.campaigns_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                campaign_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(campaign_id, user_id),
                FOREIGN KEY (campaign_id) REFERENCES campaigns.campaigns(id) ON DELETE CASCADE
            )
        `)

        // 3) Junction tables for many-to-many relationships
        await queryRunner.query(`
            CREATE TABLE campaigns.activities_events (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                activity_id UUID NOT NULL,
                event_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(activity_id, event_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE campaigns.activities_campaigns (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                activity_id UUID NOT NULL,
                campaign_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(activity_id, campaign_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE campaigns.events_campaigns (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                event_id UUID NOT NULL,
                campaign_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(event_id, campaign_id)
            )
        `)

        // 4) Foreign key constraints with CASCADE delete
        // Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE campaigns.campaigns_users
                ADD CONSTRAINT fk_cu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on campaigns_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE campaigns.campaigns_users
                ADD CONSTRAINT fk_cu_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns.campaigns(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.activities_events
                ADD CONSTRAINT fk_rd_activity FOREIGN KEY (activity_id) REFERENCES campaigns.activities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.activities_events
                ADD CONSTRAINT fk_rd_event FOREIGN KEY (event_id) REFERENCES campaigns.events(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.activities_campaigns
                ADD CONSTRAINT fk_rc_activity FOREIGN KEY (activity_id) REFERENCES campaigns.activities(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.activities_campaigns
                ADD CONSTRAINT fk_rc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns.campaigns(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.events_campaigns
                ADD CONSTRAINT fk_dc_event FOREIGN KEY (event_id) REFERENCES campaigns.events(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE campaigns.events_campaigns
                ADD CONSTRAINT fk_dc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns.campaigns(id) ON DELETE CASCADE
        `)

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_campaign ON campaigns.campaigns_users(campaign_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_user ON campaigns.campaigns_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_res ON campaigns.activities_events(activity_id)`)

        // RLS Policies for campaign isolation
        // Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE campaigns.campaigns ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.campaigns_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.events ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities_events ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities_campaigns ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.events_campaigns ENABLE ROW LEVEL SECURITY;`)

        // RLS Policies for campaigns_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their campaign memberships" ON campaigns.campaigns_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // RLS Policies for campaigns (based on campaign-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own campaigns" ON campaigns.campaigns
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.campaigns.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.campaigns.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for events (based on campaign membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage events in their campaigns" ON campaigns.events
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.events_campaigns dc
                    JOIN campaigns.campaigns_users cu ON dc.campaign_id = cu.campaign_id
                    WHERE dc.event_id = campaigns.events.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.events_campaigns dc
                    JOIN campaigns.campaigns_users cu ON dc.campaign_id = cu.campaign_id
                    WHERE dc.event_id = campaigns.events.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for activities (based on campaign membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage activities in their campaigns" ON campaigns.activities
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.activities_campaigns rc
                    JOIN campaigns.campaigns_users cu ON rc.campaign_id = cu.campaign_id
                    WHERE rc.activity_id = campaigns.activities.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.activities_campaigns rc
                    JOIN campaigns.campaigns_users cu ON rc.campaign_id = cu.campaign_id
                    WHERE rc.activity_id = campaigns.activities.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for junction tables (based on campaign membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage activities_events in their campaigns" ON campaigns.activities_events
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.activities_campaigns rc
                    JOIN campaigns.campaigns_users cu ON rc.campaign_id = cu.campaign_id
                    WHERE rc.activity_id = campaigns.activities_events.activity_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.activities_campaigns rc
                    JOIN campaigns.campaigns_users cu ON rc.campaign_id = cu.campaign_id
                    WHERE rc.activity_id = campaigns.activities_events.activity_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage activities_campaigns in their campaigns" ON campaigns.activities_campaigns
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.activities_campaigns.campaign_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.activities_campaigns.campaign_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage events_campaigns in their campaigns" ON campaigns.events_campaigns
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.events_campaigns.campaign_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns.campaigns_users cu
                    WHERE cu.campaign_id = campaigns.events_campaigns.campaign_id AND cu.user_id = auth.uid()
                )
            )
        `)

        // Additional performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_dom ON campaigns.activities_events(event_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_res ON campaigns.activities_campaigns(activity_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_clu ON campaigns.activities_campaigns(campaign_id)`)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS idx_rc_campaign_sort ON campaigns.activities_campaigns(campaign_id, sort_order)`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_dom ON campaigns.events_campaigns(event_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_clu ON campaigns.events_campaigns(campaign_id)`)

        // Search performance indexes (case-insensitive)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_campaign_name_lower 
            ON campaigns.campaigns (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_campaign_description_lower 
            ON campaigns.campaigns (LOWER("description"))
        `)

        // Full-text search indexes (GIN) for events and activities
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_events_name_fts 
            ON campaigns.events 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_events_description_fts 
            ON campaigns.events 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_activities_name_fts 
            ON campaigns.activities 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_activities_description_fts 
            ON campaigns.activities 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_events_combined_fts 
            ON campaigns.events 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_activities_combined_fts 
            ON campaigns.activities 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop full-text search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_activities_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_events_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_activities_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_activities_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_events_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_events_name_fts`)

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_campaign_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS campaigns.idx_campaign_name_lower`)

        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their campaign memberships" ON campaigns.campaigns_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own campaigns" ON campaigns.campaigns;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage events in their campaigns" ON campaigns.events;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage activities in their campaigns" ON campaigns.activities;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage activities_events in their campaigns" ON campaigns.activities_events;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage activities_campaigns in their campaigns" ON campaigns.activities_campaigns;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage events_campaigns in their campaigns" ON campaigns.events_campaigns;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE campaigns.campaigns DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.campaigns_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.events DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities_events DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.activities_campaigns DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE campaigns.events_campaigns DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.events_campaigns`)
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.activities_campaigns`)
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.activities_events`)
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.campaigns_users`)
        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.activities`)
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.events`)
        await queryRunner.query(`DROP TABLE IF EXISTS campaigns.campaigns`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS campaigns CASCADE`)
    }
}
