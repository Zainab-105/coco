import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_customer_uploads_kind" AS ENUM('image', 'video');
  CREATE TABLE "customer_uploads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_customer_uploads_kind",
  	"is_public" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "customer_accounts_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"city" varchar NOT NULL,
  	"address" varchar NOT NULL
  );
  
  CREATE TABLE "customer_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"disabled" boolean DEFAULT false,
  	"session_version" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customer_accounts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "login_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0,
  	"used" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "reviews_rels" DROP CONSTRAINT "reviews_rels_media_fk";
  
  ALTER TABLE "support_tickets_rels" DROP CONSTRAINT "support_tickets_rels_media_fk";
  
  DROP INDEX "reviews_rels_media_id_idx";
  DROP INDEX "support_tickets_rels_media_id_idx";
  ALTER TABLE "reviews_rels" ADD COLUMN "customer_uploads_id" integer;
  ALTER TABLE "support_tickets" ADD COLUMN "order_reference" varchar;
  ALTER TABLE "support_tickets_rels" ADD COLUMN "customer_uploads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_uploads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_accounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "login_codes_id" integer;
  ALTER TABLE "customer_accounts_addresses" ADD CONSTRAINT "customer_accounts_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_accounts_rels" ADD CONSTRAINT "customer_accounts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_accounts_rels" ADD CONSTRAINT "customer_accounts_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "customer_uploads_is_public_idx" ON "customer_uploads" USING btree ("is_public");
  CREATE INDEX "customer_uploads_updated_at_idx" ON "customer_uploads" USING btree ("updated_at");
  CREATE INDEX "customer_uploads_created_at_idx" ON "customer_uploads" USING btree ("created_at");
  CREATE UNIQUE INDEX "customer_uploads_filename_idx" ON "customer_uploads" USING btree ("filename");
  CREATE INDEX "customer_uploads_sizes_card_sizes_card_filename_idx" ON "customer_uploads" USING btree ("sizes_card_filename");
  CREATE INDEX "customer_accounts_addresses_order_idx" ON "customer_accounts_addresses" USING btree ("_order");
  CREATE INDEX "customer_accounts_addresses_parent_id_idx" ON "customer_accounts_addresses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customer_accounts_email_idx" ON "customer_accounts" USING btree ("email");
  CREATE INDEX "customer_accounts_updated_at_idx" ON "customer_accounts" USING btree ("updated_at");
  CREATE INDEX "customer_accounts_created_at_idx" ON "customer_accounts" USING btree ("created_at");
  CREATE INDEX "customer_accounts_rels_order_idx" ON "customer_accounts_rels" USING btree ("order");
  CREATE INDEX "customer_accounts_rels_parent_idx" ON "customer_accounts_rels" USING btree ("parent_id");
  CREATE INDEX "customer_accounts_rels_path_idx" ON "customer_accounts_rels" USING btree ("path");
  CREATE INDEX "customer_accounts_rels_products_id_idx" ON "customer_accounts_rels" USING btree ("products_id");
  CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email");
  CREATE INDEX "login_codes_updated_at_idx" ON "login_codes" USING btree ("updated_at");
  CREATE INDEX "login_codes_created_at_idx" ON "login_codes" USING btree ("created_at");
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_customer_uploads_fk" FOREIGN KEY ("customer_uploads_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_customer_uploads_fk" FOREIGN KEY ("customer_uploads_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_uploads_fk" FOREIGN KEY ("customer_uploads_id") REFERENCES "public"."customer_uploads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_accounts_fk" FOREIGN KEY ("customer_accounts_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_codes_fk" FOREIGN KEY ("login_codes_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reviews_rels_customer_uploads_id_idx" ON "reviews_rels" USING btree ("customer_uploads_id");
  CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");
  CREATE INDEX "support_tickets_rels_customer_uploads_id_idx" ON "support_tickets_rels" USING btree ("customer_uploads_id");
  CREATE INDEX "payload_locked_documents_rels_customer_uploads_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_uploads_id");
  CREATE INDEX "payload_locked_documents_rels_customer_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_login_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("login_codes_id");
  ALTER TABLE "reviews_rels" DROP COLUMN "media_id";
  ALTER TABLE "support_tickets_rels" DROP COLUMN "media_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customer_uploads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_accounts_addresses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_accounts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "login_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customer_uploads" CASCADE;
  DROP TABLE "customer_accounts_addresses" CASCADE;
  DROP TABLE "customer_accounts" CASCADE;
  DROP TABLE "customer_accounts_rels" CASCADE;
  DROP TABLE "login_codes" CASCADE;
  ALTER TABLE "reviews_rels" DROP CONSTRAINT "reviews_rels_customer_uploads_fk";
  
  ALTER TABLE "support_tickets_rels" DROP CONSTRAINT "support_tickets_rels_customer_uploads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_uploads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_login_codes_fk";
  
  DROP INDEX "reviews_rels_customer_uploads_id_idx";
  DROP INDEX "support_tickets_status_idx";
  DROP INDEX "support_tickets_rels_customer_uploads_id_idx";
  DROP INDEX "payload_locked_documents_rels_customer_uploads_id_idx";
  DROP INDEX "payload_locked_documents_rels_customer_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_login_codes_id_idx";
  ALTER TABLE "reviews_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "support_tickets_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reviews_rels_media_id_idx" ON "reviews_rels" USING btree ("media_id");
  CREATE INDEX "support_tickets_rels_media_id_idx" ON "support_tickets_rels" USING btree ("media_id");
  ALTER TABLE "reviews_rels" DROP COLUMN "customer_uploads_id";
  ALTER TABLE "support_tickets" DROP COLUMN "order_reference";
  ALTER TABLE "support_tickets_rels" DROP COLUMN "customer_uploads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_uploads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "login_codes_id";
  DROP TYPE "public"."enum_customer_uploads_kind";`)
}
