import { randomUUID } from "node:crypto"
import { z } from "zod"

import type { BoardDocument, BoardNode } from "./document"

const color = z.string().regex(/^#[0-9a-f]{6}$/i)
const coordinate = z.number().finite().min(-100000).max(100000)
const dimension = z.number().finite().min(-10000).max(10000).refine(Boolean)
const nodeType = z.enum(["rectangle", "ellipse", "sticky", "text", "line"])

const properties = {
  x: coordinate.optional(), y: coordinate.optional(), width: dimension.optional(), height: dimension.optional(),
  text: z.string().max(5000).optional(), fill: color.optional(), stroke: color.optional(),
  startId: z.string().max(50).optional(), endId: z.string().max(50).optional(),
  startSide: z.enum(["top", "right", "bottom", "left"]).optional(), endSide: z.enum(["top", "right", "bottom", "left"]).optional(),
  lineStyle: z.enum(["straight", "elbow"]).optional(), strokeStyle: z.enum(["solid", "dashed", "dotted"]).optional(), endArrow: z.boolean().optional(),
  rotation: z.number().finite().min(-3600).max(3600).optional(),
  groupId: z.string().max(50).nullable().optional(),
  locked: z.boolean().optional(), hidden: z.boolean().optional(),
  fontSize: z.number().finite().min(8).max(200).optional(), fontWeight: z.enum(["normal", "bold"]).optional(), textAlign: z.enum(["left", "center", "right"]).optional(), textColor: color.optional(),
}

export const whiteboardOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), clientId: z.string().max(80).optional(), type: nodeType, ...properties }),
  z.object({ op: z.literal("update"), nodeId: z.string().min(1).max(80), ...properties }),
  z.object({ op: z.literal("delete"), nodeId: z.string().min(1).max(80) }),
])

export const whiteboardOperationsSchema = z.array(whiteboardOperationSchema).min(1).max(100)
export type WhiteboardOperation = z.infer<typeof whiteboardOperationSchema>
type MutableProperties = Pick<BoardNode, "x" | "y" | "width" | "height" | "text" | "fill" | "stroke" | "startId" | "endId" | "startSide" | "endSide" | "lineStyle" | "strokeStyle" | "endArrow" | "rotation" | "groupId" | "locked" | "hidden" | "fontSize" | "fontWeight" | "textAlign" | "textColor">

const defaults: Record<BoardNode["type"], Omit<BoardNode, "id" | "type" | "x" | "y">> = {
  rectangle: { width: 180, height: 120, text: "", fill: "#ffffff", stroke: "#555555" },
  ellipse: { width: 180, height: 120, text: "", fill: "#ffffff", stroke: "#555555" },
  sticky: { width: 180, height: 180, text: "Write a note…", fill: "#ffe48d", stroke: "#e6c34d" },
  text: { width: 180, height: 48, text: "Text", fill: "#ffffff", stroke: "#1d1d1f" },
  line: { width: 180, height: 1, text: "", fill: "#ffffff", stroke: "#555555" },
}

export function applyWhiteboardOperations(document: BoardDocument, operations: WhiteboardOperation[]) {
  const nodes = document.nodes.map((node) => ({ ...node }))
  const created: Record<string, string> = {}
  for (const operation of operations) {
    if (operation.op === "add") {
      const base = defaults[operation.type]
      const node: BoardNode = {
        id: randomUUID(), type: operation.type, x: operation.x ?? 0, y: operation.y ?? 0,
        width: operation.width ?? base.width, height: operation.height ?? base.height,
        text: operation.text ?? base.text, fill: operation.fill ?? base.fill, stroke: operation.stroke ?? base.stroke,
        startId: operation.startId, endId: operation.endId, startSide: operation.startSide, endSide: operation.endSide,
        lineStyle: operation.lineStyle, strokeStyle: operation.strokeStyle, endArrow: operation.endArrow,
        rotation: operation.rotation,
        groupId: operation.groupId ?? undefined,
        locked: operation.locked, hidden: operation.hidden,
        fontSize: operation.fontSize, fontWeight: operation.fontWeight, textAlign: operation.textAlign, textColor: operation.textColor,
      }
      nodes.push(node)
      if (operation.clientId) created[operation.clientId] = node.id
      continue
    }
    const index = nodes.findIndex((node) => node.id === operation.nodeId)
    if (index < 0) throw new Error(`Whiteboard node not found: ${operation.nodeId}`)
    if (operation.op === "delete") nodes.splice(index, 1)
    else {
      const changes: Partial<MutableProperties> = {}
      if (operation.x !== undefined) changes.x = operation.x
      if (operation.y !== undefined) changes.y = operation.y
      if (operation.width !== undefined) changes.width = operation.width
      if (operation.height !== undefined) changes.height = operation.height
      if (operation.text !== undefined) changes.text = operation.text
      if (operation.fill !== undefined) changes.fill = operation.fill
      if (operation.stroke !== undefined) changes.stroke = operation.stroke
      if (operation.startId !== undefined) changes.startId = operation.startId
      if (operation.endId !== undefined) changes.endId = operation.endId
      if (operation.startSide !== undefined) changes.startSide = operation.startSide
      if (operation.endSide !== undefined) changes.endSide = operation.endSide
      if (operation.lineStyle !== undefined) changes.lineStyle = operation.lineStyle
      if (operation.strokeStyle !== undefined) changes.strokeStyle = operation.strokeStyle
      if (operation.endArrow !== undefined) changes.endArrow = operation.endArrow
      if (operation.rotation !== undefined) changes.rotation = operation.rotation
      if (operation.groupId !== undefined) changes.groupId = operation.groupId ?? undefined
      if (operation.locked !== undefined) changes.locked = operation.locked
      if (operation.hidden !== undefined) changes.hidden = operation.hidden
      if (operation.fontSize !== undefined) changes.fontSize = operation.fontSize
      if (operation.fontWeight !== undefined) changes.fontWeight = operation.fontWeight
      if (operation.textAlign !== undefined) changes.textAlign = operation.textAlign
      if (operation.textColor !== undefined) changes.textColor = operation.textColor
      nodes[index] = { ...nodes[index], ...changes }
    }
  }
  if (nodes.length > 2000) throw new Error("A whiteboard cannot contain more than 2000 objects")
  return { document: { version: 1 as const, nodes }, created }
}
