import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const itemsRouter = Router();

itemsRouter.get("/:id", async (req, res) => {
  const item = await prisma.item.findUnique({
    where: { id: req.params.id },
    include: { concepts: { include: { concept: true } } },
  });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json(item);
});

const flagSchema = z.object({ flagged: z.boolean(), note: z.string().optional() });

// Lets the user flag AI-generated content that's wrong or oversimplified so it
// stops surfacing until reviewed — this is a study tool, not a clinical one.
itemsRouter.post("/:id/flag", async (req, res) => {
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: { flagged: parsed.data.flagged, flagNote: parsed.data.note ?? null },
  });
  res.json(item);
});
