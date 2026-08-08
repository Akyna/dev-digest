ALTER TABLE "conventions" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "evidence_line" integer;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "evidence_end_line" integer;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "support_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "conventions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;