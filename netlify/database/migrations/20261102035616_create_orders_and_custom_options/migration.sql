CREATE TABLE "custom_options" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"user_id" text,
	"id" text,
	"customer" text DEFAULT '' NOT NULL,
	"app" text DEFAULT '' NOT NULL,
	"plan" text DEFAULT '' NOT NULL,
	"users" text DEFAULT '' NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'days' NOT NULL,
	"account" text DEFAULT '' NOT NULL,
	"fh" text DEFAULT '' NOT NULL,
	"income" integer DEFAULT 0 NOT NULL,
	"expense" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT '' NOT NULL,
	"deleted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_pkey" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "custom_options_unique_name" ON "custom_options" ("user_id","kind",lower("name"));--> statement-breakpoint
CREATE INDEX "orders_user_synced_idx" ON "orders" ("user_id","synced_at");