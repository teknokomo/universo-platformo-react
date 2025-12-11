import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProjectsMilestonesTasks1741277700000 implements MigrationInterface {
    name = 'AddProjectsMilestonesTasks1741277700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Core tables: projects, milestones, tasks (snake_case)
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS projects;`)

        // Core tables in projects schema
        await queryRunner.query(`
            CREATE TABLE projects.projects (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE projects.milestones (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE projects.tasks (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 2) User-project relationship table (project-centric naming, snake_case)
        await queryRunner.query(`
            CREATE TABLE projects.projects_users (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                project_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(project_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects.projects(id) ON DELETE CASCADE
            )
        `)

        // 3) Junction tables for many-to-many relationships (snake_case)
        await queryRunner.query(`
            CREATE TABLE projects.tasks_milestones (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                task_id UUID NOT NULL,
                milestone_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(task_id, milestone_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE projects.tasks_projects (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                task_id UUID NOT NULL,
                project_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(task_id, project_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE projects.milestones_projects (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
                milestone_id UUID NOT NULL,
                project_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(milestone_id, project_id)
            )
        `)

        // 4) Foreign key constraints with CASCADE delete
        // Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE projects.projects_users
                ADD CONSTRAINT fk_pu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on projects_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE projects.projects_users
                ADD CONSTRAINT fk_pu_project FOREIGN KEY (project_id) REFERENCES projects.projects(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.tasks_milestones
                ADD CONSTRAINT fk_tm_task FOREIGN KEY (task_id) REFERENCES projects.tasks(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.tasks_milestones
                ADD CONSTRAINT fk_tm_milestone FOREIGN KEY (milestone_id) REFERENCES projects.milestones(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.tasks_projects
                ADD CONSTRAINT fk_tp_task FOREIGN KEY (task_id) REFERENCES projects.tasks(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.tasks_projects
                ADD CONSTRAINT fk_tp_project FOREIGN KEY (project_id) REFERENCES projects.projects(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.milestones_projects
                ADD CONSTRAINT fk_mp_milestone FOREIGN KEY (milestone_id) REFERENCES projects.milestones(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE projects.milestones_projects
                ADD CONSTRAINT fk_mp_project FOREIGN KEY (project_id) REFERENCES projects.projects(id) ON DELETE CASCADE
        `)

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pu_project ON projects.projects_users(project_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pu_user ON projects.projects_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tm_task ON projects.tasks_milestones(task_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tm_milestone ON projects.tasks_milestones(milestone_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tp_task ON projects.tasks_projects(task_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tp_project ON projects.tasks_projects(project_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tp_project_sort ON projects.tasks_projects(project_id, sort_order)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mp_milestone ON projects.milestones_projects(milestone_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mp_project ON projects.milestones_projects(project_id)`)

        // 6) Search performance indexes (case-insensitive)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_project_name_lower 
            ON projects.projects (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_project_description_lower 
            ON projects.projects (LOWER("description"))
        `)

        // 7) Full-text search indexes for milestones (from second migration)
        await queryRunner.query(`
            CREATE INDEX idx_milestones_name_fts 
            ON projects.milestones 
            USING GIN (to_tsvector('english', name))
        `)

        await queryRunner.query(`
            CREATE INDEX idx_milestones_description_fts 
            ON projects.milestones 
            USING GIN (to_tsvector('english', description))
        `)

        await queryRunner.query(`
            CREATE INDEX idx_milestones_combined_fts 
            ON projects.milestones 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        // 8) Full-text search indexes for tasks (from second migration)
        await queryRunner.query(`
            CREATE INDEX idx_tasks_name_fts 
            ON projects.tasks 
            USING GIN (to_tsvector('english', name))
        `)

        await queryRunner.query(`
            CREATE INDEX idx_tasks_description_fts 
            ON projects.tasks 
            USING GIN (to_tsvector('english', description))
        `)

        await queryRunner.query(`
            CREATE INDEX idx_tasks_combined_fts 
            ON projects.tasks 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        // 9) RLS Policies for project isolation
        // Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE projects.projects ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.projects_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.milestones ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks_milestones ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks_projects ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.milestones_projects ENABLE ROW LEVEL SECURITY;`)

        // RLS Policies for projects_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their project memberships" ON projects.projects_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // RLS Policies for projects (based on project-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own projects" ON projects.projects
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.projects.id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.projects.id AND pu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for milestones (based on project membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage milestones in their projects" ON projects.milestones
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.milestones_projects mp
                    JOIN projects.projects_users pu ON mp.project_id = pu.project_id
                    WHERE mp.milestone_id = projects.milestones.id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.milestones_projects mp
                    JOIN projects.projects_users pu ON mp.project_id = pu.project_id
                    WHERE mp.milestone_id = projects.milestones.id AND pu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for tasks (based on project membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage tasks in their projects" ON projects.tasks
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.tasks_projects tp
                    JOIN projects.projects_users pu ON tp.project_id = pu.project_id
                    WHERE tp.task_id = projects.tasks.id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.tasks_projects tp
                    JOIN projects.projects_users pu ON tp.project_id = pu.project_id
                    WHERE tp.task_id = projects.tasks.id AND pu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for junction tables (based on project membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage tasks_milestones in their projects" ON projects.tasks_milestones
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.tasks_projects tp
                    JOIN projects.projects_users pu ON tp.project_id = pu.project_id
                    WHERE tp.task_id = projects.tasks_milestones.task_id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.tasks_projects tp
                    JOIN projects.projects_users pu ON tp.project_id = pu.project_id
                    WHERE tp.task_id = projects.tasks_milestones.task_id AND pu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage tasks_projects in their projects" ON projects.tasks_projects
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.tasks_projects.project_id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.tasks_projects.project_id AND pu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage milestones_projects in their projects" ON projects.milestones_projects
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.milestones_projects.project_id AND pu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM projects.projects_users pu
                    WHERE pu.project_id = projects.milestones_projects.project_id AND pu.user_id = auth.uid()
                )
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop full-text search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_tasks_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_tasks_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_tasks_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_milestones_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_milestones_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_milestones_name_fts`)

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_project_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS projects.idx_project_name_lower`)

        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their project memberships" ON projects.projects_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own projects" ON projects.projects;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage milestones in their projects" ON projects.milestones;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage tasks in their projects" ON projects.tasks;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage tasks_milestones in their projects" ON projects.tasks_milestones;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage tasks_projects in their projects" ON projects.tasks_projects;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage milestones_projects in their projects" ON projects.milestones_projects;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE projects.projects DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.projects_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.milestones DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks_milestones DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.tasks_projects DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE projects.milestones_projects DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS projects.milestones_projects`)
        await queryRunner.query(`DROP TABLE IF EXISTS projects.tasks_projects`)
        await queryRunner.query(`DROP TABLE IF EXISTS projects.tasks_milestones`)
        await queryRunner.query(`DROP TABLE IF EXISTS projects.projects_users`)
        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS projects.tasks`)
        await queryRunner.query(`DROP TABLE IF EXISTS projects.milestones`)
        await queryRunner.query(`DROP TABLE IF EXISTS projects.projects`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS projects CASCADE`)
    }
}
