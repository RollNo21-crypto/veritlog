ALTER TABLE "comments" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "next_steps" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "required_documents" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "is_escalated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "has_template_issue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "is_duplicate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "mismatch_warning" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "is_translated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "original_language" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "compliance_score" integer DEFAULT 100 NOT NULL;