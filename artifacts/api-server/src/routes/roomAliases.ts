import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, roomAliasesTable } from "@workspace/db";
import { SetRoomAliasBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/room-aliases", async (_req, res) => {
  const rows = await db.select().from(roomAliasesTable);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.areaId] = r.name;
  res.json(out);
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
  const now = new Date();
  const [row] = await db
    .insert(roomAliasesTable)
    .values({ areaId, name, updatedAt: now })
    .onConflictDoUpdate({
      target: roomAliasesTable.areaId,
      set: { name, updatedAt: now },
    })
    .returning();
  res.json({
    areaId: row.areaId,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete("/room-aliases/:areaId", async (req, res) => {
  await db
    .delete(roomAliasesTable)
    .where(eq(roomAliasesTable.areaId, req.params.areaId));
  res.status(204).end();
});

export default router;
