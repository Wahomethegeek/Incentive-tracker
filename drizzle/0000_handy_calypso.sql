CREATE TABLE `incentive_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracking_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`employee_email` text NOT NULL,
	`department` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`incentive_code` text NOT NULL,
	`incentive_title` text NOT NULL,
	`incentive_section` text NOT NULL,
	`amount_label` text NOT NULL,
	`claimed_amount` integer DEFAULT 0 NOT NULL,
	`period` text NOT NULL,
	`completed_on` text NOT NULL,
	`client_or_project` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Submitted' NOT NULL,
	`manager_notes` text DEFAULT '' NOT NULL,
	`submitted_by_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incentive_submissions_tracking_id_unique` ON `incentive_submissions` (`tracking_id`);--> statement-breakpoint
CREATE TABLE `submission_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `incentive_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
