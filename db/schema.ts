import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const constructionRecords = sqliteTable(
  "construction_records",
  {
    ownerEmail: text("owner_email").notNull(),
    projectKey: text("project_key").notNull(),
    stateJson: text("state_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerEmail, table.projectKey] }),
  ],
);
