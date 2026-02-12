ALTER TABLE `notices` ADD `file_name` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `file_url` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `file_size` integer;--> statement-breakpoint
ALTER TABLE `notices` ADD `authority` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `notice_type` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `amount` integer;--> statement-breakpoint
ALTER TABLE `notices` ADD `deadline` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `section` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `financial_year` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `confidence` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `status` text DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE `notices` ADD `source` text DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE `notices` ADD `verified_by` text;--> statement-breakpoint
ALTER TABLE `notices` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `notices` ADD `updated_at` integer DEFAULT (unixepoch()) NOT NULL;