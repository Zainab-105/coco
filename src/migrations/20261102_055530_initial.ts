import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_status" AS ENUM('new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded');
  CREATE TYPE "public"."enum_orders_payment_method" AS ENUM('cod', 'jazzcash', 'easypaisa', 'bank_transfer');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'awaiting_verification', 'paid', 'failed', 'refunded');
  CREATE TYPE "public"."enum_orders_fulfilment_courier" AS ENUM('TCS', 'Leopards', 'PostEx', 'Trax', 'M&P', 'Other');
  CREATE TYPE "public"."enum_orders_source" AS ENUM('website', 'whatsapp', 'instagram', 'manual');
  CREATE TYPE "public"."enum_customers_segment" AS ENUM('new', 'repeat', 'high_value', 'inactive');
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('simple', 'variable', 'bundle');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_products_stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock');
  CREATE TYPE "public"."enum_fragrances_family" AS ENUM('floral', 'fresh', 'citrus', 'woody', 'oriental', 'aquatic', 'gourmand');
  CREATE TYPE "public"."enum_media_kind" AS ENUM('image', 'video', 'audio');
  CREATE TYPE "public"."enum_inventory_adjustments_reason" AS ENUM('order', 'order_reversal', 'restock', 'damage', 'correction');
  CREATE TYPE "public"."enum_coupons_type" AS ENUM('percentage', 'fixed', 'free_shipping');
  CREATE TYPE "public"."enum_banners_placement" AS ENUM('hero', 'announcement', 'category');
  CREATE TYPE "public"."enum_subscribers_status" AS ENUM('subscribed', 'unsubscribed');
  CREATE TYPE "public"."enum_reviews_status" AS ENUM('pending', 'approved', 'hidden', 'spam');
  CREATE TYPE "public"."enum_support_tickets_type" AS ENUM('enquiry', 'complaint', 'feedback', 'return');
  CREATE TYPE "public"."enum_support_tickets_priority" AS ENUM('low', 'normal', 'high');
  CREATE TYPE "public"."enum_support_tickets_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');
  CREATE TYPE "public"."enum_expenses_category" AS ENUM('advertising', 'packaging', 'courier', 'salaries', 'hosting', 'other');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('owner', 'manager', 'staff');
  CREATE TYPE "public"."enum_activity_logs_action" AS ENUM('create', 'update', 'delete', 'export');
  CREATE TYPE "public"."enum_store_settings_inventory_deduct_stock_on" AS ENUM('placed', 'confirmed');
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant_id" varchar,
  	"title" varchar NOT NULL,
  	"variant_label" varchar,
  	"sku" varchar,
  	"unit_price" numeric NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"line_total" numeric,
  	"unit_cost" numeric
  );
  
  CREATE TABLE "orders_internal_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar NOT NULL,
  	"author_id" integer
  );
  
  CREATE TABLE "orders_status_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" varchar,
  	"changed_at" timestamp(3) with time zone,
  	"changed_by_id" integer
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar,
  	"status" "enum_orders_status" DEFAULT 'new' NOT NULL,
  	"customer_id" integer,
  	"subtotal" numeric,
  	"discount" numeric DEFAULT 0,
  	"shipping_fee" numeric DEFAULT 0,
  	"total" numeric,
  	"coupon_id" integer,
  	"shipping_address_full_name" varchar NOT NULL,
  	"shipping_address_phone" varchar NOT NULL,
  	"shipping_address_city" varchar NOT NULL,
  	"shipping_address_address" varchar NOT NULL,
  	"email" varchar,
  	"marketing_consent" boolean DEFAULT false,
  	"gift_wrap" boolean DEFAULT false,
  	"gift_note" varchar,
  	"payment_method" "enum_orders_payment_method" DEFAULT 'cod' NOT NULL,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'pending' NOT NULL,
  	"payment_transaction_id" varchar,
  	"payment_paid_at" timestamp(3) with time zone,
  	"payment_proof_id" integer,
  	"payment_gateway_response" jsonb,
  	"fulfilment_courier" "enum_orders_fulfilment_courier",
  	"fulfilment_tracking_number" varchar,
  	"fulfilment_shipped_at" timestamp(3) with time zone,
  	"fulfilment_delivered_at" timestamp(3) with time zone,
  	"refund_amount" numeric,
  	"refund_reason" varchar,
  	"source" "enum_orders_source" DEFAULT 'website',
  	"stock_deducted" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"city" varchar NOT NULL,
  	"address" varchar NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"marketing_email_consent" boolean DEFAULT false,
  	"marketing_whatsapp_consent" boolean DEFAULT false,
  	"marketing_consent_updated_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"order_count" numeric DEFAULT 0,
  	"total_spent" numeric DEFAULT 0,
  	"average_order_value" numeric DEFAULT 0,
  	"first_order_at" timestamp(3) with time zone,
  	"last_order_at" timestamp(3) with time zone,
  	"segment" "enum_customers_segment" DEFAULT 'new',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "products_specifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "products_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer NOT NULL
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"fragrance_id" integer,
  	"sku" varchar,
  	"price" numeric,
  	"sale_price" numeric,
  	"cost_price" numeric,
  	"stock" numeric DEFAULT 0,
  	"image_id" integer
  );
  
  CREATE TABLE "products_bundle_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"quantity" numeric DEFAULT 1
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"product_type" "enum_products_product_type" DEFAULT 'simple' NOT NULL,
  	"short_description" varchar,
  	"description" jsonb,
  	"price" numeric NOT NULL,
  	"sale_price" numeric,
  	"cost_price" numeric,
  	"sku" varchar,
  	"stock" numeric DEFAULT 0,
  	"low_stock_threshold" numeric DEFAULT 5,
  	"weight_grams" numeric,
  	"gift_wrap_available" boolean DEFAULT false,
  	"delivery_note" varchar,
  	"slug" varchar,
  	"status" "enum_products_status" DEFAULT 'draft',
  	"total_stock" numeric,
  	"stock_status" "enum_products_stock_status",
  	"category_id" integer NOT NULL,
  	"featured" boolean,
  	"is_new_arrival" boolean,
  	"sales_count" numeric DEFAULT 0,
  	"rating_average" numeric DEFAULT 0,
  	"rating_count" numeric DEFAULT 0,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"fragrances_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"parent_id" integer,
  	"description" varchar,
  	"image_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"show_in_menu" boolean DEFAULT true,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fragrances" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"family" "enum_fragrances_family",
  	"mood" varchar,
  	"top_notes" varchar,
  	"heart_notes" varchar,
  	"base_notes" varchar,
  	"swatch" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"kind" "enum_media_kind",
  	"poster_id" integer,
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
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_large_url" varchar,
  	"sizes_large_width" numeric,
  	"sizes_large_height" numeric,
  	"sizes_large_mime_type" varchar,
  	"sizes_large_filesize" numeric,
  	"sizes_large_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "inventory_adjustments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant_id" varchar,
  	"quantity_change" numeric NOT NULL,
  	"reason" "enum_inventory_adjustments_reason" NOT NULL,
  	"reference" varchar,
  	"note" varchar,
  	"adjusted_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"description" varchar,
  	"type" "enum_coupons_type" DEFAULT 'percentage' NOT NULL,
  	"value" numeric DEFAULT 0,
  	"max_discount" numeric,
  	"min_order_amount" numeric,
  	"usage_limit" numeric,
  	"per_customer_limit" numeric,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"active" boolean DEFAULT true,
  	"usage_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "banners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"placement" "enum_banners_placement" DEFAULT 'hero' NOT NULL,
  	"desktop_image_id" integer,
  	"mobile_image_id" integer,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"sort_order" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"status" "enum_subscribers_status" DEFAULT 'subscribed',
  	"source" varchar,
  	"consent_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"unsubscribe_token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"customer_id" integer,
  	"order_id" integer,
  	"author_name" varchar NOT NULL,
  	"rating" numeric NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"verified_purchase" boolean DEFAULT false,
  	"status" "enum_reviews_status" DEFAULT 'pending',
  	"admin_reply" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "support_tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_support_tickets_type" DEFAULT 'enquiry',
  	"priority" "enum_support_tickets_priority" DEFAULT 'normal',
  	"subject" varchar NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"message" varchar,
  	"customer_id" integer,
  	"order_id" integer,
  	"status" "enum_support_tickets_status" DEFAULT 'open',
  	"assigned_to_id" integer,
  	"resolution_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "support_tickets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"category" "enum_expenses_category",
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "activity_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"action" "enum_activity_logs_action",
  	"target_collection" varchar,
  	"target_id" varchar,
  	"summary" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"orders_id" integer,
  	"customers_id" integer,
  	"products_id" integer,
  	"categories_id" integer,
  	"fragrances_id" integer,
  	"media_id" integer,
  	"inventory_adjustments_id" integer,
  	"coupons_id" integer,
  	"banners_id" integer,
  	"subscribers_id" integer,
  	"reviews_id" integer,
  	"support_tickets_id" integer,
  	"expenses_id" integer,
  	"users_id" integer,
  	"activity_logs_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "store_settings_shipping_city_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"city" varchar NOT NULL,
  	"rate" numeric NOT NULL
  );
  
  CREATE TABLE "store_settings_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "store_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_name" varchar DEFAULT 'COCO',
  	"tagline" varchar DEFAULT 'Little Scents. Big Vibes.',
  	"whatsapp_number" varchar,
  	"support_email" varchar,
  	"support_phone" varchar,
  	"address" varchar,
  	"social_instagram" varchar,
  	"social_facebook" varchar,
  	"social_tiktok" varchar,
  	"shipping_flat_rate" numeric DEFAULT 250,
  	"shipping_free_shipping_threshold" numeric DEFAULT 3000,
  	"shipping_delivery_estimate" varchar DEFAULT '2-5 working days',
  	"payments_cod_enabled" boolean DEFAULT true,
  	"payments_cod_max_order_value" numeric DEFAULT 25000,
  	"payments_jazzcash_enabled" boolean DEFAULT false,
  	"payments_easypaisa_enabled" boolean DEFAULT false,
  	"payments_manual_transfer_instructions" varchar,
  	"gift_wrap_enabled" boolean DEFAULT true,
  	"gift_wrap_price" numeric DEFAULT 150,
  	"inventory_deduct_stock_on" "enum_store_settings_inventory_deduct_stock_on" DEFAULT 'placed',
  	"inventory_allow_backorders" boolean DEFAULT false,
  	"crm_high_value_threshold" numeric DEFAULT 15000,
  	"crm_inactive_after_days" numeric DEFAULT 90,
  	"shipping_policy" jsonb,
  	"return_policy" jsonb,
  	"privacy_policy" jsonb,
  	"terms" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_internal_notes" ADD CONSTRAINT "orders_internal_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_internal_notes" ADD CONSTRAINT "orders_internal_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_status_history" ADD CONSTRAINT "orders_status_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_status_history" ADD CONSTRAINT "orders_status_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_proof_id_media_id_fk" FOREIGN KEY ("payment_proof_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_features" ADD CONSTRAINT "products_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_specifications" ADD CONSTRAINT "products_specifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_gallery" ADD CONSTRAINT "products_gallery_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_gallery" ADD CONSTRAINT "products_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_fragrance_id_fragrances_id_fk" FOREIGN KEY ("fragrance_id") REFERENCES "public"."fragrances"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_bundle_items" ADD CONSTRAINT "products_bundle_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_bundle_items" ADD CONSTRAINT "products_bundle_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_fragrances_fk" FOREIGN KEY ("fragrances_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_adjusted_by_id_users_id_fk" FOREIGN KEY ("adjusted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_desktop_image_id_media_id_fk" FOREIGN KEY ("desktop_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "support_tickets_rels" ADD CONSTRAINT "support_tickets_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fragrances_fk" FOREIGN KEY ("fragrances_id") REFERENCES "public"."fragrances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_adjustments_fk" FOREIGN KEY ("inventory_adjustments_id") REFERENCES "public"."inventory_adjustments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_tickets_fk" FOREIGN KEY ("support_tickets_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_logs_fk" FOREIGN KEY ("activity_logs_id") REFERENCES "public"."activity_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_shipping_city_rates" ADD CONSTRAINT "store_settings_shipping_city_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "store_settings_faqs" ADD CONSTRAINT "store_settings_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."store_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  CREATE INDEX "orders_internal_notes_order_idx" ON "orders_internal_notes" USING btree ("_order");
  CREATE INDEX "orders_internal_notes_parent_id_idx" ON "orders_internal_notes" USING btree ("_parent_id");
  CREATE INDEX "orders_internal_notes_author_idx" ON "orders_internal_notes" USING btree ("author_id");
  CREATE INDEX "orders_status_history_order_idx" ON "orders_status_history" USING btree ("_order");
  CREATE INDEX "orders_status_history_parent_id_idx" ON "orders_status_history" USING btree ("_parent_id");
  CREATE INDEX "orders_status_history_changed_by_idx" ON "orders_status_history" USING btree ("changed_by_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_total_idx" ON "orders" USING btree ("total");
  CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id");
  CREATE INDEX "orders_shipping_address_shipping_address_phone_idx" ON "orders" USING btree ("shipping_address_phone");
  CREATE INDEX "orders_payment_payment_status_idx" ON "orders" USING btree ("payment_status");
  CREATE INDEX "orders_payment_payment_proof_idx" ON "orders" USING btree ("payment_proof_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "products_features_order_idx" ON "products_features" USING btree ("_order");
  CREATE INDEX "products_features_parent_id_idx" ON "products_features" USING btree ("_parent_id");
  CREATE INDEX "products_specifications_order_idx" ON "products_specifications" USING btree ("_order");
  CREATE INDEX "products_specifications_parent_id_idx" ON "products_specifications" USING btree ("_parent_id");
  CREATE INDEX "products_gallery_order_idx" ON "products_gallery" USING btree ("_order");
  CREATE INDEX "products_gallery_parent_id_idx" ON "products_gallery" USING btree ("_parent_id");
  CREATE INDEX "products_gallery_media_idx" ON "products_gallery" USING btree ("media_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_variants_fragrance_idx" ON "products_variants" USING btree ("fragrance_id");
  CREATE INDEX "products_variants_image_idx" ON "products_variants" USING btree ("image_id");
  CREATE INDEX "products_bundle_items_order_idx" ON "products_bundle_items" USING btree ("_order");
  CREATE INDEX "products_bundle_items_parent_id_idx" ON "products_bundle_items" USING btree ("_parent_id");
  CREATE INDEX "products_bundle_items_product_idx" ON "products_bundle_items" USING btree ("product_id");
  CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_total_stock_idx" ON "products" USING btree ("total_stock");
  CREATE INDEX "products_stock_status_idx" ON "products" USING btree ("stock_status");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_meta_meta_image_idx" ON "products" USING btree ("meta_image_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_fragrances_id_idx" ON "products_rels" USING btree ("fragrances_id");
  CREATE INDEX "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_meta_meta_image_idx" ON "categories" USING btree ("meta_image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "fragrances_slug_idx" ON "fragrances" USING btree ("slug");
  CREATE INDEX "fragrances_updated_at_idx" ON "fragrances" USING btree ("updated_at");
  CREATE INDEX "fragrances_created_at_idx" ON "fragrances" USING btree ("created_at");
  CREATE INDEX "media_kind_idx" ON "media" USING btree ("kind");
  CREATE INDEX "media_poster_idx" ON "media" USING btree ("poster_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_large_sizes_large_filename_idx" ON "media" USING btree ("sizes_large_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE INDEX "inventory_adjustments_product_idx" ON "inventory_adjustments" USING btree ("product_id");
  CREATE INDEX "inventory_adjustments_adjusted_by_idx" ON "inventory_adjustments" USING btree ("adjusted_by_id");
  CREATE INDEX "inventory_adjustments_updated_at_idx" ON "inventory_adjustments" USING btree ("updated_at");
  CREATE INDEX "inventory_adjustments_created_at_idx" ON "inventory_adjustments" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE INDEX "coupons_rels_order_idx" ON "coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_categories_id_idx" ON "coupons_rels" USING btree ("categories_id");
  CREATE INDEX "banners_desktop_image_idx" ON "banners" USING btree ("desktop_image_id");
  CREATE INDEX "banners_mobile_image_idx" ON "banners" USING btree ("mobile_image_id");
  CREATE INDEX "banners_updated_at_idx" ON "banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "banners" USING btree ("created_at");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "subscribers_unsubscribe_token_idx" ON "subscribers" USING btree ("unsubscribe_token");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");
  CREATE INDEX "reviews_customer_idx" ON "reviews" USING btree ("customer_id");
  CREATE INDEX "reviews_order_idx" ON "reviews" USING btree ("order_id");
  CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "reviews_rels_order_idx" ON "reviews_rels" USING btree ("order");
  CREATE INDEX "reviews_rels_parent_idx" ON "reviews_rels" USING btree ("parent_id");
  CREATE INDEX "reviews_rels_path_idx" ON "reviews_rels" USING btree ("path");
  CREATE INDEX "reviews_rels_media_id_idx" ON "reviews_rels" USING btree ("media_id");
  CREATE INDEX "support_tickets_customer_idx" ON "support_tickets" USING btree ("customer_id");
  CREATE INDEX "support_tickets_order_idx" ON "support_tickets" USING btree ("order_id");
  CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets" USING btree ("assigned_to_id");
  CREATE INDEX "support_tickets_updated_at_idx" ON "support_tickets" USING btree ("updated_at");
  CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets" USING btree ("created_at");
  CREATE INDEX "support_tickets_rels_order_idx" ON "support_tickets_rels" USING btree ("order");
  CREATE INDEX "support_tickets_rels_parent_idx" ON "support_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "support_tickets_rels_path_idx" ON "support_tickets_rels" USING btree ("path");
  CREATE INDEX "support_tickets_rels_media_id_idx" ON "support_tickets_rels" USING btree ("media_id");
  CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");
  CREATE INDEX "activity_logs_updated_at_idx" ON "activity_logs" USING btree ("updated_at");
  CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_fragrances_id_idx" ON "payload_locked_documents_rels" USING btree ("fragrances_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_adjustments_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_adjustments_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_support_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("support_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_activity_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_logs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "store_settings_shipping_city_rates_order_idx" ON "store_settings_shipping_city_rates" USING btree ("_order");
  CREATE INDEX "store_settings_shipping_city_rates_parent_id_idx" ON "store_settings_shipping_city_rates" USING btree ("_parent_id");
  CREATE INDEX "store_settings_faqs_order_idx" ON "store_settings_faqs" USING btree ("_order");
  CREATE INDEX "store_settings_faqs_parent_id_idx" ON "store_settings_faqs" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders_internal_notes" CASCADE;
  DROP TABLE "orders_status_history" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "products_features" CASCADE;
  DROP TABLE "products_specifications" CASCADE;
  DROP TABLE "products_gallery" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_bundle_items" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "fragrances" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "inventory_adjustments" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "coupons_rels" CASCADE;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "subscribers" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "reviews_rels" CASCADE;
  DROP TABLE "support_tickets" CASCADE;
  DROP TABLE "support_tickets_rels" CASCADE;
  DROP TABLE "expenses" CASCADE;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "activity_logs" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "store_settings_shipping_city_rates" CASCADE;
  DROP TABLE "store_settings_faqs" CASCADE;
  DROP TABLE "store_settings" CASCADE;
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_payment_method";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_orders_fulfilment_courier";
  DROP TYPE "public"."enum_orders_source";
  DROP TYPE "public"."enum_customers_segment";
  DROP TYPE "public"."enum_products_product_type";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_stock_status";
  DROP TYPE "public"."enum_fragrances_family";
  DROP TYPE "public"."enum_media_kind";
  DROP TYPE "public"."enum_inventory_adjustments_reason";
  DROP TYPE "public"."enum_coupons_type";
  DROP TYPE "public"."enum_banners_placement";
  DROP TYPE "public"."enum_subscribers_status";
  DROP TYPE "public"."enum_reviews_status";
  DROP TYPE "public"."enum_support_tickets_type";
  DROP TYPE "public"."enum_support_tickets_priority";
  DROP TYPE "public"."enum_support_tickets_status";
  DROP TYPE "public"."enum_expenses_category";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_activity_logs_action";
  DROP TYPE "public"."enum_store_settings_inventory_deduct_stock_on";`)
}
