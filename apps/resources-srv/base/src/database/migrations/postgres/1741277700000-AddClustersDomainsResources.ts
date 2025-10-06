import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddClustersDomainsResources1741277700000 implements MigrationInterface {
    name = 'AddClustersDomainsResources1741277700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

        // 1) Core tables: clusters, domains, resources
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS resources;`)

        // Core tables in resources schema
        await queryRunner.query(`
            CREATE TABLE resources.clusters (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE resources.domains (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE TABLE resources.resources (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                updated_at TIMESTAMP NOT NULL DEFAULT now()
            )
        `)

        // 2) User-cluster relationship table (cluster-centric naming)
        await queryRunner.query(`
            CREATE TABLE resources.clusters_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                cluster_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'owner',
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(cluster_id, user_id),
                FOREIGN KEY (cluster_id) REFERENCES resources.clusters(id) ON DELETE CASCADE
            )
        `)

        // 3) Junction tables for many-to-many relationships
        await queryRunner.query(`
            CREATE TABLE resources.resources_domains (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                resource_id UUID NOT NULL,
                domain_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(resource_id, domain_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE resources.resources_clusters (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                resource_id UUID NOT NULL,
                cluster_id UUID NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(resource_id, cluster_id)
            )
        `)

        await queryRunner.query(`
            CREATE TABLE resources.domains_clusters (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                domain_id UUID NOT NULL,
                cluster_id UUID NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE(domain_id, cluster_id)
            )
        `)

        // 4) Foreign key constraints with CASCADE delete
        // Add foreign key for user_id to auth.users
        try {
            await queryRunner.query(`
                ALTER TABLE resources.clusters_users
                ADD CONSTRAINT fk_cu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
            `)
        } catch (error) {
            console.warn(
                'Warning: Unable to add FK constraint on clusters_users.user_id referencing auth.users. Continuing without it.',
                error
            )
        }

        await queryRunner.query(`
            ALTER TABLE resources.clusters_users
                ADD CONSTRAINT fk_cu_cluster FOREIGN KEY (cluster_id) REFERENCES resources.clusters(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.resources_domains
                ADD CONSTRAINT fk_rd_resource FOREIGN KEY (resource_id) REFERENCES resources.resources(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.resources_domains
                ADD CONSTRAINT fk_rd_domain FOREIGN KEY (domain_id) REFERENCES resources.domains(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.resources_clusters
                ADD CONSTRAINT fk_rc_resource FOREIGN KEY (resource_id) REFERENCES resources.resources(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.resources_clusters
                ADD CONSTRAINT fk_rc_cluster FOREIGN KEY (cluster_id) REFERENCES resources.clusters(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.domains_clusters
                ADD CONSTRAINT fk_dc_domain FOREIGN KEY (domain_id) REFERENCES resources.domains(id) ON DELETE CASCADE
        `)
        await queryRunner.query(`
            ALTER TABLE resources.domains_clusters
                ADD CONSTRAINT fk_dc_cluster FOREIGN KEY (cluster_id) REFERENCES resources.clusters(id) ON DELETE CASCADE
        `)

        // 5) Performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_cluster ON resources.clusters_users(cluster_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cu_user ON resources.clusters_users(user_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_res ON resources.resources_domains(resource_id)`)

        // RLS Policies for cluster isolation
        // Enable RLS on all tables
        await queryRunner.query(`ALTER TABLE resources.clusters ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.clusters_users ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.domains ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources_domains ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources_clusters ENABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.domains_clusters ENABLE ROW LEVEL SECURITY;`)

        // RLS Policies for clusters_users table
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their cluster memberships" ON resources.clusters_users
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        `)

        // RLS Policies for clusters (based on cluster-user relationship)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage their own clusters" ON resources.clusters
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.clusters.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.clusters.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for domains (based on cluster membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage domains in their clusters" ON resources.domains
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.domains_clusters dc
                    JOIN resources.clusters_users cu ON dc.cluster_id = cu.cluster_id
                    WHERE dc.domain_id = resources.domains.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.domains_clusters dc
                    JOIN resources.clusters_users cu ON dc.cluster_id = cu.cluster_id
                    WHERE dc.domain_id = resources.domains.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for resources (based on cluster membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage resources in their clusters" ON resources.resources
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.resources_clusters rc
                    JOIN resources.clusters_users cu ON rc.cluster_id = cu.cluster_id
                    WHERE rc.resource_id = resources.resources.id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.resources_clusters rc
                    JOIN resources.clusters_users cu ON rc.cluster_id = cu.cluster_id
                    WHERE rc.resource_id = resources.resources.id AND cu.user_id = auth.uid()
                )
            )
        `)

        // RLS Policies for junction tables (based on cluster membership)
        await queryRunner.query(`
            CREATE POLICY "Allow users to manage resources_domains in their clusters" ON resources.resources_domains
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.resources_clusters rc
                    JOIN resources.clusters_users cu ON rc.cluster_id = cu.cluster_id
                    WHERE rc.resource_id = resources.resources_domains.resource_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.resources_clusters rc
                    JOIN resources.clusters_users cu ON rc.cluster_id = cu.cluster_id
                    WHERE rc.resource_id = resources.resources_domains.resource_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage resources_clusters in their clusters" ON resources.resources_clusters
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.resources_clusters.cluster_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.resources_clusters.cluster_id AND cu.user_id = auth.uid()
                )
            )
        `)

        await queryRunner.query(`
            CREATE POLICY "Allow users to manage domains_clusters in their clusters" ON resources.domains_clusters
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.domains_clusters.cluster_id AND cu.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM resources.clusters_users cu
                    WHERE cu.cluster_id = resources.domains_clusters.cluster_id AND cu.user_id = auth.uid()
                )
            )
        `)

        // Additional performance indexes
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rd_dom ON resources.resources_domains(domain_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_res ON resources.resources_clusters(resource_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_clu ON resources.resources_clusters(cluster_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rc_cluster_sort ON resources.resources_clusters(cluster_id, sort_order)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_dom ON resources.domains_clusters(domain_id)`)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dc_clu ON resources.domains_clusters(cluster_id)`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop RLS policies first
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their cluster memberships" ON resources.clusters_users;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage their own clusters" ON resources.clusters;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage domains in their clusters" ON resources.domains;`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow users to manage resources in their clusters" ON resources.resources;`)
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage resources_domains in their clusters" ON resources.resources_domains;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage resources_clusters in their clusters" ON resources.resources_clusters;`
        )
        await queryRunner.query(
            `DROP POLICY IF EXISTS "Allow users to manage domains_clusters in their clusters" ON resources.domains_clusters;`
        )

        // Disable RLS
        await queryRunner.query(`ALTER TABLE resources.clusters DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.clusters_users DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.domains DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources_domains DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.resources_clusters DISABLE ROW LEVEL SECURITY;`)
        await queryRunner.query(`ALTER TABLE resources.domains_clusters DISABLE ROW LEVEL SECURITY;`)

        // Drop junction tables first to avoid FK constraint errors
        await queryRunner.query(`DROP TABLE IF EXISTS resources.domains_clusters`)
        await queryRunner.query(`DROP TABLE IF EXISTS resources.resources_clusters`)
        await queryRunner.query(`DROP TABLE IF EXISTS resources.resources_domains`)
        await queryRunner.query(`DROP TABLE IF EXISTS resources.clusters_users`)
        // Drop core tables
        await queryRunner.query(`DROP TABLE IF EXISTS resources.resources`)
        await queryRunner.query(`DROP TABLE IF EXISTS resources.domains`)
        await queryRunner.query(`DROP TABLE IF EXISTS resources.clusters`)
        await queryRunner.query(`DROP SCHEMA IF EXISTS resources CASCADE`)
    }
}
