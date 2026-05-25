import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entityAliasesTable = pgTable("entity_aliases", {
  entityId: text("entity_id").primaryKey(),
  alias: text("alias").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EntityAliasRow = typeof entityAliasesTable.$inferSelect;
