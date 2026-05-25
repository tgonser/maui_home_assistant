import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roomAliasesTable = pgTable("room_aliases", {
  areaId: text("area_id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RoomAliasRow = typeof roomAliasesTable.$inferSelect;
