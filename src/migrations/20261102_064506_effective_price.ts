import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "effective_price" numeric;
  CREATE INDEX "products_effective_price_idx" ON "products" USING btree ("effective_price");`)

  // Backfill existing products (variant price overrides are picked up on the next save).
  await db.execute(sql`
   UPDATE "products" SET "effective_price" = CASE
     WHEN "sale_price" > 0 AND "sale_price" < "price" THEN "sale_price"
     ELSE "price"
   END;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "products_effective_price_idx";
  ALTER TABLE "products" DROP COLUMN "effective_price";`)
}
