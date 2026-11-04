import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" ADD COLUMN "gift_wrap_fee" numeric DEFAULT 0;
  ALTER TABLE "orders" ADD COLUMN "access_token" varchar;
  CREATE INDEX "orders_access_token_idx" ON "orders" USING btree ("access_token");`)

  // Existing orders get a random token so their customer links can be shared safely.
  await db.execute(sql`
   UPDATE "orders" SET "access_token" = md5(random()::text || clock_timestamp()::text || "id"::text)
   WHERE "access_token" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "orders_access_token_idx";
  ALTER TABLE "orders" DROP COLUMN "gift_wrap_fee";
  ALTER TABLE "orders" DROP COLUMN "access_token";`)
}
