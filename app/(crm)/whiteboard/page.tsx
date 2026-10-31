import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRightIcon, Clock3Icon, PlusIcon, ShapesIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { createWhiteboard, createWhiteboardFromTemplate } from "@/lib/actions/whiteboards"
import { can, requirePermission } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { parseBoardDocument } from "@/lib/whiteboard/document"
import { connectorPoints } from "@/lib/whiteboard/geometry"
import { BoardActions } from "./board-actions"

export const metadata: Metadata = { title: "Whiteboard" }

function Thumbnail({ content }: { content: unknown }) {
  const doc = parseBoardDocument(content)
  if (!doc.nodes.length) return <span className="rotate-[-3deg] rounded-md bg-[#ffe48d] px-6 py-5 text-sm font-medium shadow-sm">Start with an idea</span>
  const nodes = doc.nodes.filter((node) => !node.hidden)
  const minX = Math.min(...nodes.map((node) => Math.min(node.x, node.x + node.width)), 0), minY = Math.min(...nodes.map((node) => Math.min(node.y, node.y + node.height)), 0)
  const maxX = Math.max(...nodes.map((node) => Math.max(node.x, node.x + node.width)), 1), maxY = Math.max(...nodes.map((node) => Math.max(node.y, node.y + node.height)), 1)
  return <svg className="size-full" viewBox={`${minX - 40} ${minY - 40} ${maxX - minX + 80} ${maxY - minY + 80}`} aria-hidden>{nodes.map((node) => {
    if (node.type === "line") { const points = connectorPoints(node, nodes); return <line key={node.id} x1={points.start.x} y1={points.start.y} x2={points.end.x} y2={points.end.y} stroke={node.stroke} strokeWidth="3" /> }
    const shape = node.type === "ellipse" ? <ellipse cx={node.x + node.width / 2} cy={node.y + node.height / 2} rx={Math.abs(node.width / 2)} ry={Math.abs(node.height / 2)} fill={node.fill} stroke={node.stroke} strokeWidth="2" /> : <rect x={Math.min(node.x, node.x + node.width)} y={Math.min(node.y, node.y + node.height)} width={Math.abs(node.width)} height={Math.abs(node.height)} rx={node.type === "sticky" ? 2 : 8} fill={node.fill} stroke={node.stroke} strokeWidth="2" />
    return <g key={node.id} transform={`rotate(${node.rotation ?? 0} ${node.x + node.width / 2} ${node.y + node.height / 2})`}>{shape}{node.text && <text x={node.x + 10} y={node.y + 28} fontSize={node.fontSize ?? 16} fill={node.textColor ?? "#1d1d1f"}>{node.text.slice(0, 24)}</text>}</g>
  })}</svg>
}

export default async function WhiteboardsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const user = await requirePermission("whiteboard", "READ")
  const { q = "", sort = "updated" } = await searchParams
  const canWrite = await can(user, "whiteboard", "WRITE")
  const unrestricted = user.role === "OWNER" || user.role === "ADMIN"
  const access = unrestricted ? {} : { OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }, { members: { none: {} } }] }
  const boards = await db.whiteboard.findMany({ where: { ...access, ...(q.trim() ? { name: { contains: q.trim() } } : {}) }, orderBy: sort === "name" ? [{ favorite: "desc" }, { name: "asc" }] : sort === "recent" ? [{ favorite: "desc" }, { lastOpenedAt: "desc" }, { updatedAt: "desc" }] : [{ favorite: "desc" }, { updatedAt: "desc" }], include: { createdBy: { select: { name: true } } } })
  return <>
    <PageHeader title="Whiteboard" description="Think visually, map flows and turn rough ideas into shared plans." actions={canWrite && <form action={createWhiteboard}><Button type="submit"><PlusIcon />New board</Button></form>} />
    <div className="mb-5 flex flex-wrap items-center gap-2"><form className="flex w-full flex-wrap gap-2 sm:w-auto"><input name="q" defaultValue={q} placeholder="Search boards" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" /><select name="sort" defaultValue={sort} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="updated">Last updated</option><option value="recent">Recently opened</option><option value="name">Name</option></select><Button type="submit" variant="outline">Apply</Button></form>{canWrite && <div className="ml-auto flex flex-wrap gap-2">{(["brainstorm", "flowchart", "retrospective"] as const).map((template) => <form key={template} action={createWhiteboardFromTemplate.bind(null, template)}><Button type="submit" variant="outline" className="capitalize">{template}</Button></form>)}</div>}</div>
    {boards.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{boards.map((board) => <li key={board.id} className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"><Link href={`/whiteboard/${board.id}`} className="block"><div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[#f6f6f6] [background-image:radial-gradient(#d6d6d6_1px,transparent_1px)] [background-size:18px_18px]"><Thumbnail content={board.content} /><ArrowUpRightIcon className="absolute right-4 top-4 size-5 text-muted-foreground opacity-0 transition group-hover:opacity-100" /></div><div className="space-y-1 p-4 pr-32"><p className="truncate font-heading font-medium">{board.name}</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3Icon className="size-3" />{board.lastOpenedAt ? `Opened ${board.lastOpenedAt.toLocaleDateString()}` : `Updated ${board.updatedAt.toLocaleDateString()}`} · {board.createdBy?.name ?? "Former member"}</p></div></Link><BoardActions id={board.id} favorite={board.favorite} canManage={unrestricted || board.createdById === user.id} /></li>)}</ul> : <EmptyState icon={ShapesIcon} title={q ? "No matching boards." : "No boards yet."} description={q ? "Try a different search." : "Create a board for your next idea, workshop or project flow."} />}
  </>
}
