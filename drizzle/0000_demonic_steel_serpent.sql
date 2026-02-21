CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`notice_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`file_size` integer,
	`file_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`business_name` text NOT NULL,
	`gstin` text,
	`pan` text,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`notice_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`notice_id`) REFERENCES `notices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text,
	`file_name` text,
	`file_url` text,
	`file_size` integer,
	`file_hash` text,
	`authority` text,
	`notice_type` text,
	`amount` integer,
	`deadline` text,
	`section` text,
	`financial_year` text,
	`summary` text,
	`confidence` text,
	`risk_level` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`assigned_to` text,
	`verified_by` text,
	`verified_at` integer,
	`closed_at` integer,
	`closed_by` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
