CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"discord_id" text,
	"role" text DEFAULT 'player' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_email_unique" UNIQUE("email"),
	CONSTRAINT "account_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" text PRIMARY KEY NOT NULL,
	"pilot_id" uuid NOT NULL,
	"def" text NOT NULL,
	"kind" text NOT NULL,
	"upgrade" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loadout" (
	"pilot_id" uuid NOT NULL,
	"frame" text NOT NULL,
	"slots" jsonb NOT NULL,
	CONSTRAINT "loadout_pilot_id_frame_pk" PRIMARY KEY("pilot_id","frame")
);
--> statement-breakpoint
CREATE TABLE "pilot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"nation" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"scrap" integer DEFAULT 0 NOT NULL,
	"glory" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pilot_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_pilot_id_pilot_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."pilot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadout" ADD CONSTRAINT "loadout_pilot_id_pilot_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."pilot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot" ADD CONSTRAINT "pilot_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;