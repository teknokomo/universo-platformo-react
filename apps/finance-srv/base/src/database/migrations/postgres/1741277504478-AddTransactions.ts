import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTransactions1741277504478 implements MigrationInterface {
    name = 'AddTransactions1741277504478'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "unik_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `)

        try {
            await queryRunner.query(`
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_user"
            FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
      `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint on transactions.user_id referencing auth.users.', error)
        }

        try {
            await queryRunner.query(`
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_unik"
            FOREIGN KEY ("unik_id") REFERENCES uniks.uniks(id) ON DELETE CASCADE
      `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint on transactions.unik_id referencing uniks.uniks.', error)
        }

        await queryRunner.query(`ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;`)

        // Membership-aware RLS: only members of the unik can see/insert/update transactions
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow select transactions for authenticated users" ON "transactions";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow insert transactions for authenticated users" ON "transactions";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow update transactions for authenticated users" ON "transactions";`)

        await queryRunner.query(`
      CREATE POLICY transactions_select_members ON "transactions"
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM uniks.uniks_users uu
          WHERE uu.unik_id = transactions.unik_id AND uu.user_id = auth.uid()
        )
      );
    `)
        await queryRunner.query(`
      CREATE POLICY transactions_insert_members ON "transactions"
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM uniks.uniks_users uu
          WHERE uu.unik_id = transactions.unik_id AND uu.user_id = auth.uid()
        )
      );
    `)
        await queryRunner.query(`
      CREATE POLICY transactions_update_members ON "transactions"
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM uniks.uniks_users uu
          WHERE uu.unik_id = transactions.unik_id AND uu.user_id = auth.uid()
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM uniks.uniks_users uu
          WHERE uu.unik_id = transactions.unik_id AND uu.user_id = auth.uid()
        )
      );
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP POLICY IF EXISTS transactions_select_members ON "transactions";`)
  await queryRunner.query(`DROP POLICY IF EXISTS transactions_insert_members ON "transactions";`)
  await queryRunner.query(`DROP POLICY IF EXISTS transactions_update_members ON "transactions";`)

        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_user";`)
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_unik";`)

        await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`)
    }
}
