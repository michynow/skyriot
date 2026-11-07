ALTER TABLE "item" ADD COLUMN "rarity" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "mods" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "ms_left" integer;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "bag" integer;--> statement-breakpoint
ALTER TABLE "pilot" ADD COLUMN "charms" jsonb DEFAULT '[null,null,null]'::jsonb NOT NULL;