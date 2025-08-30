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
            FOREIGN KEY ("unik_id") REFERENCES "uniks"("id") ON DELETE CASCADE
      `)
        } catch (error) {
            console.warn('Warning: Unable to add FK constraint on transactions.unik_id referencing uniks.', error)
        }

        await queryRunner.query(`ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;`)

        await queryRunner.query(`
      CREATE POLICY "Allow select transactions for authenticated users"
      ON "transactions"
      FOR SELECT
      USING (auth.role() = 'authenticated')
    `)

        await queryRunner.query(`
      CREATE POLICY "Allow insert transactions for authenticated users"
      ON "transactions"
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated')
    `)

        await queryRunner.query(`
      CREATE POLICY "Allow update transactions for authenticated users"
      ON "transactions"
      FOR UPDATE
      USING (auth.role() = 'authenticated')
    `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow select transactions for authenticated users" ON "transactions";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow insert transactions for authenticated users" ON "transactions";`)
        await queryRunner.query(`DROP POLICY IF EXISTS "Allow update transactions for authenticated users" ON "transactions";`)

        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_user";`)
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_unik";`)

        await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`)
    }
}
