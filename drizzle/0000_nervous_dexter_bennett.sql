CREATE TABLE `fatura_lease` (
	`fatura_id` integer PRIMARY KEY NOT NULL,
	`emitindo_since` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`target` text NOT NULL,
	`external_id` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`aggregate` text NOT NULL,
	`aggregate_id` integer NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
