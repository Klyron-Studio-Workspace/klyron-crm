import "server-only"

import { timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { logEvent } from "@/lib/audit"
import { hashToken } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { publish } from "@/lib/realtime/bus"
import { emptyBoard, parseBoardDocument } from "@/lib/whiteboard/document"
import { applyWhiteboardOperations, whiteboardOperationsSchema } from "@/lib/whiteboard/operations"

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] })
const limit = z.number().int().min(1).max(100).default(25)
const whiteboardProperties = {
  x: { type: "number", minimum: -100000, maximum: 100000 }, y: { type: "number", minimum: -100000, maximum: 100000 },
  width: { type: "number", minimum: -10000, maximum: 10000 }, height: { type: "number", minimum: -10000, maximum: 10000 },
  text: { type: "string", maxLength: 5000 }, fill: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, stroke: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
  startId: { type: "string" }, endId: { type: "string" }, startSide: { type: "string", enum: ["top", "right", "bottom", "left"] }, endSide: { type: "string", enum: ["top", "right", "bottom", "left"] },
  lineStyle: { type: "string", enum: ["straight", "elbow"] }, strokeStyle: { type: "string", enum: ["solid", "dashed", "dotted"] }, endArrow: { type: "boolean" },
  rotation: { type: "number", minimum: -3600, maximum: 3600 },
  groupId: { type: ["string", "null"], maxLength: 50, description: "Shared ID groups objects; set null to ungroup." },
  locked: { type: "boolean" }, hidden: { type: "boolean" },
  fontSize: { type: "number", minimum: 8, maximum: 200 }, fontWeight: { type: "string", enum: ["normal", "bold"] }, textAlign: { type: "string", enum: ["left", "center", "right"] }, textColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
}
const whiteboardOperationSchema = {
  oneOf: [
    { type: "object", properties: { op: { const: "add" }, clientId: { type: "string", maxLength: 80 }, type: { type: "string", enum: ["rectangle", "ellipse", "sticky", "text", "line"] }, ...whiteboardProperties }, required: ["op", "type"] },
    { type: "object", properties: { op: { const: "update" }, nodeId: { type: "string" }, ...whiteboardProperties }, required: ["op", "nodeId"] },
    { type: "object", properties: { op: { const: "delete" }, nodeId: { type: "string" } }, required: ["op", "nodeId"] },
  ],
}

const tools = [
  { name: "crm_overview", description: "Get counts of open leads, active projects, overdue invoices, and due follow-ups.", inputSchema: { type: "object", properties: {} } },
  { name: "search_leads", description: "Search CRM leads by contact or company name.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 100 } }, required: ["query"] } },
  { name: "list_projects", description: "List recent projects, optionally filtered by status.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] }, limit: { type: "number", minimum: 1, maximum: 100 } } } },
  { name: "list_invoices", description: "List recent invoices with balances and due dates.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["DRAFT", "SENT", "PAID", "VOID"] }, limit: { type: "number", minimum: 1, maximum: 100 } } } },
  { name: "add_lead_note", description: "Add an internal note to an existing lead.", inputSchema: { type: "object", properties: { leadId: { type: "string" }, body: { type: "string", maxLength: 10000 } }, required: ["leadId", "body"] } },
  { name: "create_project_task", description: "Create a to-do task in an existing project.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, title: { type: "string", maxLength: 200 } }, required: ["projectId", "title"] } },
  { name: "whiteboard_capabilities", description: "Read the whiteboard object model, coordinate rules, supported operations, and explicit limitations. Call this before designing or editing a board.", inputSchema: { type: "object", properties: {} } },
  { name: "list_whiteboards", description: "List whiteboards and their IDs. Use an ID with get_whiteboard or edit_whiteboard.", inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100 } } } },
  { name: "get_whiteboard", description: "Read one complete whiteboard document, including all object IDs and the updatedAt version required for safe edits.", inputSchema: { type: "object", properties: { boardId: { type: "string" } }, required: ["boardId"] } },
  { name: "create_whiteboard", description: "Create an empty whiteboard. Then call edit_whiteboard with semantic add operations to build its contents.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 120 } }, required: ["name"] } },
  { name: "edit_whiteboard", description: "Atomically add, update, or delete up to 100 whiteboard objects. Read the board first and pass expectedUpdatedAt to prevent overwriting another editor. clientId on add maps your temporary name to the created node ID.", inputSchema: { type: "object", properties: { boardId: { type: "string" }, expectedUpdatedAt: { type: "string", format: "date-time" }, operations: { type: "array", minItems: 1, maxItems: 100, items: whiteboardOperationSchema } }, required: ["boardId", "expectedUpdatedAt", "operations"] } },
]

export async function validMcpToken(header: string | null) {
  // ponytail: one service token suits the studio's trusted tools; add per-user OAuth before granting third parties access.
  const supplied = header?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!supplied) return false
  const org = await db.orgSettings.findUnique({ where: { id: "org" }, select: { mcpTokenHash: true } })
  if (!org?.mcpTokenHash) return false
  return timingSafeEqual(Buffer.from(org.mcpTokenHash, "hex"), Buffer.from(hashToken(supplied), "hex"))
}

async function callTool(name: string, raw: unknown) {
  const input = raw && typeof raw === "object" ? raw : {}
  if (name === "crm_overview") {
    const now = new Date()
    const [openLeads, activeProjects, overdueInvoices, dueFollowUps] = await Promise.all([
      db.lead.count({ where: { stage: { kind: "OPEN" } } }),
      db.project.count({ where: { status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } }),
      db.invoice.count({ where: { status: "SENT", dueDate: { lt: now }, amountPaid: { lt: db.invoice.fields.total } } }),
      db.reminder.count({ where: { completedAt: null, dueAt: { lte: now } } }),
    ])
    return text({ openLeads, activeProjects, overdueInvoices, dueFollowUps })
  }
  if (name === "search_leads") {
    const value = z.object({ query: z.string().trim().min(1).max(120), limit }).parse(input)
    return text(await db.lead.findMany({
      where: { OR: [{ name: { contains: value.query } }, { company: { contains: value.query } }] },
      select: { id: true, name: true, company: true, value: true, currency: true, stage: { select: { name: true, kind: true } }, owner: { select: { name: true } }, updatedAt: true },
      orderBy: { updatedAt: "desc" }, take: value.limit,
    }))
  }
  if (name === "list_projects") {
    const value = z.object({ status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(), limit }).parse(input)
    return text(await db.project.findMany({ where: { status: value.status }, select: { id: true, name: true, status: true, dueDate: true, client: { select: { name: true } }, owner: { select: { name: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: "desc" }, take: value.limit }))
  }
  if (name === "list_invoices") {
    const value = z.object({ status: z.enum(["DRAFT", "SENT", "PAID", "VOID"]).optional(), limit }).parse(input)
    const rows = await db.invoice.findMany({ where: { status: value.status }, select: { id: true, number: true, status: true, currency: true, total: true, amountPaid: true, dueDate: true, client: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: value.limit })
    return text(rows.map((row) => ({ ...row, total: Number(row.total), amountPaid: Number(row.amountPaid), balance: Number(row.total) - Number(row.amountPaid) })))
  }
  if (name === "add_lead_note") {
    const value = z.object({ leadId: z.string().min(1), body: z.string().trim().min(1).max(10_000) }).parse(input)
    const lead = await db.lead.findUnique({ where: { id: value.leadId }, select: { id: true } })
    if (!lead) throw new Error("Lead not found")
    const note = await db.leadNote.create({ data: { leadId: lead.id, type: "NOTE", body: value.body, authorName: "MCP" } })
    await logEvent({ actor: { type: "SYSTEM", id: null, name: "MCP" }, action: "lead.note.create", entity: { type: "lead", id: lead.id }, metadata: { noteId: note.id, type: "NOTE", via: "mcp" } })
    return text({ id: note.id, created: true })
  }
  if (name === "create_project_task") {
    const value = z.object({ projectId: z.string().min(1), title: z.string().trim().min(1).max(200) }).parse(input)
    const project = await db.project.findUnique({ where: { id: value.projectId }, select: { id: true } })
    if (!project) throw new Error("Project not found")
    const last = await db.task.findFirst({ where: { projectId: project.id, status: "TODO" }, orderBy: { position: "desc" }, select: { position: true } })
    const task = await db.task.create({ data: { projectId: project.id, title: value.title, status: "TODO", position: (last?.position ?? 0) + 1 } })
    await logEvent({ actor: { type: "SYSTEM", id: null, name: "MCP" }, action: "task.create", entity: { type: "project", id: project.id }, metadata: { title: task.title, via: "mcp" } })
    return text({ id: task.id, created: true })
  }
  if (name === "whiteboard_capabilities") {
    return text({
      version: 1,
      workflow: ["Call list_whiteboards or create_whiteboard.", "Call get_whiteboard before every edit.", "Plan coordinates and operations.", "Call edit_whiteboard with the returned updatedAt.", "On a conflict, read again and reapply intentionally."],
      canvas: { coordinates: "Infinite 2D canvas. x increases right; y increases down. Values are pixels.", recommendedViewport: { width: 1200, height: 700 }, recommendedSpacing: 32 },
      objects: {
        rectangle: "Box or card; supports position, size, fill, and stroke.", ellipse: "Circle or oval; supports position, size, fill, and stroke.",
        sticky: "Short note; put its visible content in text.", text: "Standalone text box.", line: "Connector from (x,y) to (x+width,y+height); optionally attach endpoints with startId/startSide and endId/endSide, and choose straight/elbow, solid/dashed/dotted, and endArrow.",
      },
      operations: ["add", "update", "delete"],
      constraints: { maxObjectsPerBoard: 2000, maxOperationsPerCall: 100, colors: "Six-digit hex only", textMaxLength: 5000 },
      unsupported: ["Images", "freehand drawing", "rotation", "groups", "frames", "rich text", "comments", "animations"],
      guidance: ["Do not invent unsupported object types or properties.", "Prefer readable spacing and modest object counts.", "Use clientId for each add so returned IDs can be referenced later.", "Never replace the raw board document."],
    })
  }
  if (name === "list_whiteboards") {
    const value = z.object({ limit }).parse(input)
    const boards = await db.whiteboard.findMany({ select: { id: true, name: true, content: true, updatedAt: true, createdAt: true }, orderBy: { updatedAt: "desc" }, take: value.limit })
    return text(boards.map(({ content, ...board }) => ({ ...board, objectCount: parseBoardDocument(content).nodes.length })))
  }
  if (name === "get_whiteboard") {
    const value = z.object({ boardId: z.string().min(1) }).parse(input)
    const board = await db.whiteboard.findUnique({ where: { id: value.boardId }, select: { id: true, name: true, content: true, updatedAt: true, revision: true } })
    if (!board) throw new Error("Whiteboard not found")
    return text({ id: board.id, name: board.name, updatedAt: board.updatedAt.toISOString(), revision: board.revision, ...parseBoardDocument(board.content) })
  }
  if (name === "create_whiteboard") {
    const value = z.object({ name: z.string().trim().min(1).max(120) }).parse(input)
    const board = await db.whiteboard.create({ data: { name: value.name, content: emptyBoard, versions: { create: { revision: 0, content: emptyBoard } } } })
    await logEvent({ actor: { type: "SYSTEM", id: null, name: "MCP" }, action: "whiteboard.create", entity: { type: "whiteboard", id: board.id }, metadata: { name: board.name, via: "mcp" } })
    return text({ id: board.id, name: board.name, updatedAt: board.updatedAt.toISOString(), created: true })
  }
  if (name === "edit_whiteboard") {
    const value = z.object({ boardId: z.string().min(1), expectedUpdatedAt: z.iso.datetime(), operations: whiteboardOperationsSchema }).parse(input)
    const board = await db.whiteboard.findUnique({ where: { id: value.boardId }, select: { content: true, updatedAt: true, revision: true } })
    if (!board) throw new Error("Whiteboard not found")
    if (board.updatedAt.toISOString() !== value.expectedUpdatedAt) throw new Error("Whiteboard changed since it was read. Call get_whiteboard and retry against the latest version.")
    const applied = applyWhiteboardOperations(parseBoardDocument(board.content), value.operations)
    const revision = board.revision + 1
    const changed = await db.whiteboard.updateMany({ where: { id: value.boardId, updatedAt: board.updatedAt, revision: board.revision }, data: { content: applied.document, revision } })
    if (!changed.count) throw new Error("Whiteboard changed during this edit. Call get_whiteboard and retry against the latest version.")
    await db.whiteboardVersion.create({ data: { boardId: value.boardId, revision, content: applied.document } })
    const updated = await db.whiteboard.findUnique({ where: { id: value.boardId }, select: { updatedAt: true } })
    const audience = await db.user.findMany({ where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MEMBER"] } }, select: { id: true } })
    publish(audience.map((user) => user.id), { type: "whiteboard.update", boardId: value.boardId, revision, document: applied.document, actorId: "mcp" })
    await logEvent({ actor: { type: "SYSTEM", id: null, name: "MCP" }, action: "whiteboard.edit", entity: { type: "whiteboard", id: value.boardId }, metadata: { operations: value.operations.length, via: "mcp" } })
    return text({ updated: true, updatedAt: updated!.updatedAt.toISOString(), revision, createdNodeIds: applied.created, objectCount: applied.document.nodes.length })
  }
  throw new Error(`Unknown tool: ${name}`)
}

export async function handleMcp(body: unknown) {
  const request = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.unknown().optional() }).parse(body)
  const params = request.params && typeof request.params === "object" ? request.params as Record<string, unknown> : {}
  let result: unknown
  if (request.method === "initialize") result = { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "klyron-crm", version: "1.0.0" } }
  else if (request.method === "notifications/initialized") return null
  else if (request.method === "tools/list") result = { tools }
  else if (request.method === "tools/call") result = await callTool(String(params.name ?? ""), params.arguments)
  else throw new Error(`Unsupported method: ${request.method}`)
  return { jsonrpc: "2.0", id: request.id ?? null, result }
}
