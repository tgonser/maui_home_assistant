import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entityAliasesTable } from "@workspace/db";
import { SetEntityAliasBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/entity-aliases", async (_req, res) => {
  const rows = await db.select().from(entityAliasesTable);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.entityId] = r.alias;
  res.json(out);
});

router.put("/entity-aliases/:entityId", async (req, res) => {
  const entityId = req.params.entityId;
  if (!entityId || entityId.length > 200) {
    return res.status(400).json({ error: "Invalid entityId" });
  }
  const parsed = SetEntityAliasBody.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const alias = parsed.data.alias.trim();
  if (!alias) {
    return res.status(400).json({ error: "Alias cannot be blank" });
  }
  const now = new Date();
  const [row] = await db
    .insert(entityAliasesTable)
    .values({ entityId, alias, updatedAt: now })
    .onConflictDoUpdate({
      target: entityAliasesTable.entityId,
      set: { alias, updatedAt: now },
    })
    .returning();
  return res.json({
    entityId: row.entityId,
    alias: row.alias,
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.delete("/entity-aliases/:entityId", async (req, res) => {
  await db
    .delete(entityAliasesTable)
    .where(eq(entityAliasesTable.entityId, req.params.entityId));
  res.status(204).end();
});

export default router;
