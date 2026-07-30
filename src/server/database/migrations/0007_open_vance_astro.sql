CREATE TABLE `trial_installations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`request_ip_hash` text NOT NULL,
	`client_id` integer NOT NULL,
	`campaign` text,
	`started_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients_table`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trial_installations_token_hash_unique` ON `trial_installations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `trial_installations_client_id_unique` ON `trial_installations` (`client_id`);