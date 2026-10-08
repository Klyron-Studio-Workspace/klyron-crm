import { z } from "zod"

export const nodeKinds = ["rectangle", "ellipse", "sticky", "text", "line"] as const

export const boardNodeSchema = z.object({
  id: z.string().max(50),
  type: z.enum(nodeKinds),
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  width: z.number().finite().min(-10000).max(10000).refine(Boolean),
  height: z.number().finite().min(-10000).max(10000).refine(Boolean),
  text: z.string().max(5000).default(""),
  fill: z.string().regex(/^#[0-9a-f]{6}$/i),
  stroke: z.string().regex(/^#[0-9a-f]{6}$/i),
  startId: z.string().max(50).optional(),
  endId: z.string().max(50).optional(),
  startSide: z.enum(["top", "right", "bottom", "left"]).optional(),
  endSide: z.enum(["top", "right", "bottom", "left"]).optional(),
  lineStyle: z.enum(["straight", "elbow"]).optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  endArrow: z.boolean().optional(),
  rotation: z.number().finite().min(-3600).max(3600).optional(),
  groupId: z.string().max(50).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  fontSize: z.number().finite().min(8).max(200).optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
})

export const boardDocumentSchema = z.object({
  version: z.literal(1),
  nodes: z.array(boardNodeSchema).max(2000),
})

export type BoardNode = z.infer<typeof boardNodeSchema>
export type BoardDocument = z.infer<typeof boardDocumentSchema>

export const emptyBoard: BoardDocument = { version: 1, nodes: [] }

export function parseBoardDocument(value: unknown): BoardDocument {
  const parsed = boardDocumentSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyBoard
}
