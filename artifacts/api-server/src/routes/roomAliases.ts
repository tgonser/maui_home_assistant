import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, roomAliasesTable } from "@workspace/db";
import { SetRoomAliasBody } from "@workspace/api-zod";
import { readStore, writeStore } from "../fileStore";

const router: IRouter = Router();
const FILE = "room-aliases";

router.get("/room-aliases", async (_req, res) => {
  if (!db) {
    return res.json(readStore(FILE));
  }
  const rows = await db.select().from(roomAliasesTable);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.areaId] = r.name;
  return res.json(out);
});

router.put("/room-aliases/:areaId", async (req, res) => {
  const areaId = req.params.areaId;
  if (!areaId || areaId.length > 200) {
    return res.status(400).json({ error: "Invalid areaId" });
  }
  const parsed = SetRoomAliasBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const name = parsed.data.name.trim();
  if (!name) {
    return res.status(400).json({ error: "Name cannot be blank" });
  }

  if (!db) {
    const store = readStore(FILE);
    store[areaId] = name;
    writeStore(FILE, store);
    return res.json({ areaId, name, updatedAt: new Date().toISOString() });
  }

  const now = new Date();
  const [row] = await db
    .insert(roomAliasesTable)
    .values({ areaId, name, updatedAt: now })
    .onConflictDoUpdate({
      target: roomAliasesTable.areaId,
      set: { name, updatedAt: now },
    })
    .returning();
  return res.json({
    areaId: row.areaId,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete("/room-aliases/:areaId", async (req, res) => {
  if (!db) {
    const store = readStore(FILE);
    delete store[req.params.areaId];
    writeStore(FILE, store);
    return res.status(204).end();
  }
  await db
    .delete(roomAliasesTable)
    .where(eq(roomAliasesTable.areaId, req.params.areaId));
  return res.status(204).end();
});

export default router;
