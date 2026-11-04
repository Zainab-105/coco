import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_carts_status" AS ENUM('open', 'contacted', 'recovered', 'closed');
  CREATE TABLE "carts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"title" varchar,
  	"variant_label" varchar,
  	"quantity" numeric,
  	"unit_price" numeric,
  	"variant_id" varchar
  );
  
  CREATE TABLE "carts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"city" varchar,
  	"subtotal" numeric,
  	"notes" varchar,
  	"status" "enum_carts_status" DEFAULT 'open' NOT NULL,
  	"marketing_consent" boolean DEFAULT false,
  	"last_activity_at" timestamp(3) with time zone,
  	"order_id" integer,
  	"token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "carts_id" integer;
  ALTER TABLE "carts_items" ADD CONSTRAINT "carts_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts_items" ADD CONSTRAINT "carts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "carts_items_order_idx" ON "carts_items" USING btree ("_order");
  CREATE INDEX "carts_items_parent_id_idx" ON "carts_items" USING btree ("_parent_id");
  CREATE INDEX "carts_items_product_idx" ON "carts_items" USING btree ("product_id");
  CREATE INDEX "carts_phone_idx" ON "carts" USING btree ("phone");
  CREATE INDEX "carts_status_idx" ON "carts" USING btree ("status");
  CREATE INDEX "carts_last_activity_at_idx" ON "carts" USING btree ("last_activity_at");
  CREATE INDEX "carts_order_idx" ON "carts" USING btree ("order_id");
  CREATE UNIQUE INDEX "carts_token_idx" ON "carts" USING btree ("token");
  CREATE INDEX "carts_updated_at_idx" ON "carts" USING btree ("updated_at");
  CREATE INDEX "carts_created_at_idx" ON "carts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_carts_fk" FOREIGN KEY ("carts_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscribers_status_idx" ON "subscribers" USING btree ("status");
  CREATE INDEX "subscribers_consent_at_idx" ON "subscribers" USING btree ("consent_at");
  CREATE INDEX "subscribers_unsubscribed_at_idx" ON "subscribers" USING btree ("unsubscribed_at");
  CREATE INDEX "payload_locked_documents_rels_carts_id_idx" ON "payload_locked_documents_rels" USING btree ("carts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "carts_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "carts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "carts_items" CASCADE;
  DROP TABLE "carts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_carts_fk";
  
  DROP INDEX "subscribers_status_idx";
  DROP INDEX "subscribers_consent_at_idx";
  DROP INDEX "subscribers_unsubscribed_at_idx";
  DROP INDEX "payload_locked_documents_rels_carts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "carts_id";
  DROP TYPE "public"."enum_carts_status";`)
}
