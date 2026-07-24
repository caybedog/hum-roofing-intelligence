CREATE TABLE `construction_records` (
	`owner_email` text NOT NULL,
	`project_key` text NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner_email`, `project_key`)
);
