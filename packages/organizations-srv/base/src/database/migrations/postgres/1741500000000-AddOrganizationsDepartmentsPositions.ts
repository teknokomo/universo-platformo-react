import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOrganizationsDepartmentsPositions1741500000000 implements MigrationInterface {
    name = 'AddOrganizationsDepartmentsPositions1741500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Create schema
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS organizations;`)

        // 2) Core tables
        await queryRunner.query(`
            CREATE TABLE organizations.organizations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE organizations.departments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE organizations.positions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 3) User-organization relationship table
        await queryRunner.query(`
            CREATE TABLE organizations.organizations_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                organization_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                comment TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(organization_id, user_id),
                FOREIGN KEY (organization_id) REFERENCES organizations.organizations(id) ON DELETE CASCADE
            )
        `)

        // 4) Junction tables for many-to-many relationships
        await queryRunner.query(`
            CREATE TABLE organizations.positions_departments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                position_id UUID NOT NULL,
                department_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(position_id, department_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE organizations.positions_organizations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                position_id UUID NOT NULL,
                organization_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(position_id, organization_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE organizations.departments_organizations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                department_id UUID NOT NULL,
                organization_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(department_id, organization_id)
            )
        `)

        // 5) Foreign key constraints with CASCADE delete
        try {
            await queryRunner.query(`
                ALTER TABLE organizations.organizations_users
                ADD CONSTRAINT fk_ou_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on organizations_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE organizations.positions_departments
                ADD CONSTRAINT fk_pd_position FOREIGN KEY (position_id) REFERENCES organizations.positions(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE organizations.positions_departments
                ADD CONSTRAINT fk_pd_department FOREIGN KEY (department_id) REFERENCES organizations.departments(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE organizations.positions_organizations
                ADD CONSTRAINT fk_po_position FOREIGN KEY (position_id) REFERENCES organizations.positions(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE organizations.positions_organizations
                ADD CONSTRAINT fk_po_organization FOREIGN KEY (organization_id) REFERENCES organizations.organizations(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE organizations.departments_organizations
                ADD CONSTRAINT fk_do_department FOREIGN KEY (department_id) REFERENCES organizations.departments(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE organizations.departments_organizations
                ADD CONSTRAINT fk_do_organization FOREIGN KEY (organization_id) REFERENCES organizations.organizations(id) ON DELETE CASCADE
        `)

        // 6) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ou_organization ON organizations.organizations_users(organization_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_ou_user ON organizations.organizations_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pd_pos ON organizations.positions_departments(position_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pd_dep ON organizations.positions_departments(department_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_po_pos ON organizations.positions_organizations(position_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_po_org ON organizations.positions_organizations(organization_id)`)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS idx_po_organization_sort ON organizations.positions_organizations(organization_id, sort_order)`
        )
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_do_dep ON organizations.departments_organizations(department_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_do_org ON organizations.departments_organizations(organization_id)`)

        // 7) Search performance indexes (case-insensitive)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_organization_name_lower 
            ON organizations.organizations (LOWER("name"))
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_organization_description_lower 
            ON organizations.organizations (LOWER("description"))
        `)

        // 8) Full-text search indexes for departments
        await queryRunner.query(`
            CREATE INDEX idx_departments_name_fts 
            ON organizations.departments 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_departments_description_fts 
            ON organizations.departments 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_departments_combined_fts 
            ON organizations.departments 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        // 9) Full-text search indexes for positions
        await queryRunner.query(`
            CREATE INDEX idx_positions_name_fts 
            ON organizations.positions 
            USING GIN (to_tsvector('english', name))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_positions_description_fts 
            ON organizations.positions 
            USING GIN (to_tsvector('english', description))
        `)
        await queryRunner.query(`
            CREATE INDEX idx_positions_combined_fts 
            ON organizations.positions 
            USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')))
        `)

        // 10) Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE organizations.organizations ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.organizations_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.departments ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions_departments ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions_organizations ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.departments_organizations ENABLE ROW LEVEL SECURITY;`)

        // 11) RLS Policies for organizations_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their organization memberships" ON organizations.organizations_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // 12) RLS Policies for organizations (based on organization-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own organizations" ON organizations.organizations
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.organizations.id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.organizations.id AND ou.user_id = auth.uid()
                )
            )
        `)

        // 13) RLS Policies for departments (based on organization membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage departments in their organizations" ON organizations.departments
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.departments_organizations dorg
                    JOIN organizations.organizations_users ou ON dorg.organization_id = ou.organization_id
                    WHERE dorg.department_id = organizations.departments.id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.departments_organizations dorg
                    JOIN organizations.organizations_users ou ON dorg.organization_id = ou.organization_id
                    WHERE dorg.department_id = organizations.departments.id AND ou.user_id = auth.uid()
                )
            )
        `)

        // 14) RLS Policies for positions (based on organization membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage positions in their organizations" ON organizations.positions
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.positions_organizations po
                    JOIN organizations.organizations_users ou ON po.organization_id = ou.organization_id
                    WHERE po.position_id = organizations.positions.id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.positions_organizations po
                    JOIN organizations.organizations_users ou ON po.organization_id = ou.organization_id
                    WHERE po.position_id = organizations.positions.id AND ou.user_id = auth.uid()
                )
            )
        `)

        // 15) RLS Policies for junction tables
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage positions_departments in their organizations" ON organizations.positions_departments
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.positions_organizations po
                    JOIN organizations.organizations_users ou ON po.organization_id = ou.organization_id
                    WHERE po.position_id = organizations.positions_departments.position_id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.positions_organizations po
                    JOIN organizations.organizations_users ou ON po.organization_id = ou.organization_id
                    WHERE po.position_id = organizations.positions_departments.position_id AND ou.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage positions_organizations in their organizations" ON organizations.positions_organizations
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.positions_organizations.organization_id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.positions_organizations.organization_id AND ou.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage departments_organizations in their organizations" ON organizations.departments_organizations
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.departments_organizations.organization_id AND ou.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM organizations.organizations_users ou
                    WHERE ou.organization_id = organizations.departments_organizations.organization_id AND ou.user_id = auth.uid()
                )
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop full-text search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_positions_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_positions_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_positions_name_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_departments_combined_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_departments_description_fts`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_departments_name_fts`)

        // Drop search indexes
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_organization_description_lower`)
        await queryRunner.query(`DROP INDEX IF EXISTS organizations.idx_organization_name_lower`)

        // Drop RLS policies first
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage their organization memberships" ON organizations.organizations_users;`
        )
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own organizations" ON organizations.organizations;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage departments in their organizations" ON organizations.departments;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage positions in their organizations" ON organizations.positions;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage positions_departments in their organizations" ON organizations.positions_departments;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage positions_organizations in their organizations" ON organizations.positions_organizations;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage departments_organizations in their organizations" ON organizations.departments_organizations;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE organizations.organizations DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.organizations_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.departments DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions_departments DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.positions_organizations DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE organizations.departments_organizations DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.departments_organizations`)
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.positions_organizations`)
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.positions_departments`)
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.organizations_users`)

        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.positions`)
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.departments`)
        await queryRunner.query(`DROP TABLE IF EXISTS organizations.organizations`)

        // Drop schema
        await queryRunner.query(`DROP SCHEMA IF EXISTS organizations CASCADE`)
    }
}
