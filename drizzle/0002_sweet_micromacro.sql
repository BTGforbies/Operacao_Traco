CREATE TABLE `sales_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`opportunity_id` text,
	`client_id` text,
	`company_name` text NOT NULL,
	`title` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`document_url` text,
	`notes` text DEFAULT '' NOT NULL,
	`owner_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `sales_opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_contracts_status_idx` ON `sales_contracts` (`workspace_id`,`status`,`end_date`);--> statement-breakpoint
CREATE INDEX `sales_contracts_owner_idx` ON `sales_contracts` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `sales_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`opportunity_id` text,
	`title` text NOT NULL,
	`company_name` text NOT NULL,
	`starts_at` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`meeting_type` text DEFAULT 'online' NOT NULL,
	`location` text,
	`participants` text DEFAULT '' NOT NULL,
	`agenda` text DEFAULT '' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`responsible_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `sales_opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`responsible_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_meetings_schedule_idx` ON `sales_meetings` (`workspace_id`,`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `sales_meetings_responsible_idx` ON `sales_meetings` (`responsible_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `sales_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`service` text DEFAULT '' NOT NULL,
	`estimated_value` integer DEFAULT 0 NOT NULL,
	`stage` text DEFAULT 'lead' NOT NULL,
	`owner_id` text NOT NULL,
	`next_action_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`loss_reason` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_opportunities_stage_idx` ON `sales_opportunities` (`workspace_id`,`stage`,`next_action_at`);--> statement-breakpoint
CREATE INDEX `sales_opportunities_owner_idx` ON `sales_opportunities` (`owner_id`,`stage`);