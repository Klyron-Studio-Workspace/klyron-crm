"use client"

import Link from "next/link"
import {
  ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, CircleIcon, EyeIcon, EyeOffIcon, HandIcon, Layers3Icon, LockIcon, MinusIcon, MousePointer2Icon, Redo2Icon,
  MessageCircleIcon, RotateCcwIcon, Share2Icon, SquareIcon, StickyNoteIcon, TypeIcon, Undo2Icon, UnlockIcon, ZoomInIcon, ZoomOutIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, useTransition, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react"

import { addWhiteboardComment, getWhiteboardVersions, markWhiteboardOpened, resolveWhiteboardComment, saveWhiteboard, renameWhiteboard, updateWhiteboardPresence, updateWhiteboardSharing } from "@/lib/actions/whiteboards"
import { useRealtime } from "@/components/realtime/realtime-provider"
import type { BoardDocument, BoardNode } from "@/lib/whiteboard/document"
import { alignSelection, connectionPoint, connectorPoints, distributeSelection, dragBox, expandGroupedSelection, nearestDistances, nodeBox, resizeBox, rotatePoint, selectionBox, snapTranslation, type Alignment, type Box, type ConnectionSide, type Distribution, type ResizeHandle } from "@/lib/whiteboard/geometry"
import { cn } from "@/lib/utils"

type Tool = "select" | "hand" | "rectangle" | "ellipse" | "sticky" | "text" | "line" | "comment"
type Camera = { x: number; y: number; zoom: number }
type Drag =
  | { kind: "move"; ids: string[]; startX: number; startY: number; before: BoardDocument }
  | { kind: "draw"; id: string; type: BoardNode["type"]; startX: number; startY: number; before: BoardDocument }
  | { kind: "endpoint"; id: string; endpoint: "start" | "end"; before: BoardDocument }
  | { kind: "marquee"; startX: number; startY: number; additive: boolean; intersect: boolean }
  | { kind: "resize"; ids: string[]; handle: ResizeHandle; bounds: Box; startX: number; startY: number; before: BoardDocument }
  | { kind: "rotate"; ids: string[]; centerX: number; centerY: number; startAngle: number; before: BoardDocument }
  | { kind: "pan"; startX: number; startY: number; originX: number; originY: number }

const tools: { id: Tool; label: string; key: string; icon: typeof MousePointer2Icon }[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2Icon },
  { id: "hand", label: "Hand", key: "H", icon: HandIcon },
  { id: "rectangle", label: "Rectangle", key: "R", icon: SquareIcon },
  { id: "ellipse", label: "Ellipse", key: "O", icon: CircleIcon },
  { id: "line", label: "Connector", key: "L", icon: MinusIcon },
  { id: "text", label: "Text", key: "T", icon: TypeIcon },
  { id: "sticky", label: "Sticky note", key: "S", icon: StickyNoteIcon },
  { id: "comment", label: "Comment", key: "C", icon: MessageCircleIcon },
]
const fills = ["#ffffff", "#ffe48d", "#fbb7b7", "#bce6d2", "#cdd9ff"]

function id() {
  return crypto.randomUUID()
}

function newNode(type: Exclude<Tool, "select" | "hand" | "comment">, x: number, y: number): BoardNode {
  if (type === "line") return { id: id(), type, x, y, width: 180, height: 1, text: "", fill: "#ffffff", stroke: "#555555", lineStyle: "straight", strokeStyle: "solid", endArrow: true }
  if (type === "text") return { id: id(), type, x, y, width: 180, height: 48, text: "", fill: "#ffffff", stroke: "#1d1d1f", fontSize: 18, textColor: "#1d1d1f" }
  if (type === "sticky") return { id: id(), type, x, y, width: 180, height: 180, text: "", fill: "#ffe48d", stroke: "#e6c34d", fontSize: 16, textColor: "#1d1d1f" }
  return { id: id(), type, x, y, width: 180, height: 120, text: "", fill: "#ffffff", stroke: "#555555" }
}

function duplicateNodes(nodes: BoardNode[]) {
  const groups = new Map<string, string>()
  return nodes.map((node) => ({
    ...node, id: id(), x: node.x + 24, y: node.y + 24,
    groupId: node.groupId ? (groups.get(node.groupId) ?? (() => { const value = id(); groups.set(node.groupId!, value); return value })()) : undefined,
  }))
}

function stickyHeight(text: string, width: number, fontSize: number) {
  const characters = Math.max(8, Math.floor((width - 24) / (fontSize * .55)))
  const lines = text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / characters)), 0)
  return Math.max(80, lines * fontSize * 1.35 + 24)
}

function repairCollapsedNodes(document: BoardDocument) {
  let changed = false
  const nodes = document.nodes.map((node) => {
    if (node.type === "line" || Math.abs(node.width) > 1 || Math.abs(node.height) > 1) return node
    changed = true
    return { ...node, width: 180, height: node.type === "text" ? 48 : node.type === "sticky" ? 180 : 120 }
  })
  return changed ? { ...document, nodes } : document
}

type Comment = { id: string; body: string; x: number; y: number; author: string; createdAt: string; resolvedAt: string | null }
type ShareMember = { userId: string; access: "READ" | "WRITE" }
type LayerItem = { kind: "node"; node: BoardNode } | { kind: "group"; id: string; nodes: BoardNode[] }

function LayerRow({ node, active, canWrite, onSelect, onUpdate }: { node: BoardNode; active: boolean; canWrite: boolean; onSelect: (additive: boolean) => void; onUpdate: (patch: Partial<BoardNode>) => void }) {
  const label = node.text.trim().split("\n")[0]?.slice(0, 28) || node.type[0].toUpperCase() + node.type.slice(1)
  return <div className={cn("group/layer flex h-8 items-center gap-1 rounded-md px-1 text-xs hover:bg-muted", active && "bg-primary/10 text-primary")}>
    <button className="min-w-0 flex-1 truncate text-left" title={label} onClick={(event) => onSelect(event.shiftKey)}>{label}</button>
    {canWrite && <><button aria-label={node.hidden ? "Show layer" : "Hide layer"} className="grid size-6 place-items-center rounded opacity-0 hover:bg-background group-hover/layer:opacity-100 focus:opacity-100" onClick={() => onUpdate({ hidden: !node.hidden })}>{node.hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}</button><button aria-label={node.locked ? "Unlock layer" : "Lock layer"} className="grid size-6 place-items-center rounded opacity-0 hover:bg-background group-hover/layer:opacity-100 focus:opacity-100" onClick={() => onUpdate({ locked: !node.locked })}>{node.locked ? <LockIcon className="size-3.5" /> : <UnlockIcon className="size-3.5" />}</button></>}
  </div>
}

function MenuItem({ label, shortcut, danger, disabled, onClick }: { label: string; shortcut?: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40", danger && "text-destructive")}><span>{label}</span>{shortcut && <span className="ml-6 text-[11px] text-muted-foreground">{shortcut}</span>}</button>
}

export function WhiteboardEditor({ id: boardId, initialName, initialDocument, initialRevision, canWrite, canManage, initialComments, team, initialMembers }: { id: string; initialName: string; initialDocument: BoardDocument; initialRevision: number; canWrite: boolean; canManage: boolean; initialComments: Comment[]; team: { id: string; name: string }[]; initialMembers: ShareMember[] }) {
  const [doc, setDoc] = useState(() => repairCollapsedNodes(initialDocument))
  const [past, setPast] = useState<BoardDocument[]>([])
  const [future, setFuture] = useState<BoardDocument[]>([])
  const [tool, setTool] = useState<Tool>(canWrite ? "select" : "hand")
  const [selected, setSelected] = useState<string[]>([])
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [hovered, setHovered] = useState<string | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [altDown, setAltDown] = useState(false)
  const [gridSnap, setGridSnap] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set<string>())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)
  const [versions, setVersions] = useState<{ revision: number; document: unknown; createdAt: string; author: string }[] | null>(null)
  const [comments, setComments] = useState(initialComments)
  const [commentDraft, setCommentDraft] = useState<{ x: number; y: number } | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [members, setMembers] = useState(initialMembers)
  const [editing, setEditing] = useState<string | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: -300, y: -180, zoom: 1 })
  const [viewport, setViewport] = useState({ width: 1200, height: 700 })
  const [name, setName] = useState(initialName)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved")
  const [isPending, startTransition] = useTransition()
  const [conflict, setConflict] = useState<{ document: BoardDocument; revision: number } | null>(null)
  const [remoteUsers, setRemoteUsers] = useState(new Map<string, { name: string; x: number | null; y: number | null; selected: string[] }>())
  const svgRef = useRef<SVGSVGElement>(null)
  const cameraRef = useRef(camera)
  const dragRef = useRef<Drag | null>(null)
  const editBeforeRef = useRef<BoardDocument | null>(null)
  const clipboardRef = useRef<BoardNode[]>([])
  const spaceRef = useRef(false)
  const mountedRef = useRef(false)
  const repairedInitialRef = useRef(doc !== initialDocument)
  const touchesRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; zoom: number; worldX: number; worldY: number } | null>(null)
  const revisionRef = useRef(initialRevision)
  const presenceAtRef = useRef(0)
  const suppressSaveRef = useRef(false)
  const pointerFrameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<ReactPointerEvent<SVGSVGElement> | null>(null)

  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => { void markWhiteboardOpened(boardId) }, [boardId])
  useEffect(() => () => { if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current) }, [])

  const commit = useCallback((next: BoardDocument) => {
    setPast((items) => [...items.slice(-49), doc])
    setFuture([])
    setDoc(next)
  }, [doc])

  const undo = useCallback(() => {
    const previous = past.at(-1)
    if (!previous) return
    setPast((items) => items.slice(0, -1)); setFuture((items) => [doc, ...items]); setDoc(previous); setSelected([])
  }, [doc, past])
  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setFuture((items) => items.slice(1)); setPast((items) => [...items, doc]); setDoc(next); setSelected([])
  }, [doc, future])

  const beginEditing = useCallback((node: BoardNode) => {
    if (!canWrite || node.locked || (node.type !== "text" && node.type !== "sticky")) return false
    editBeforeRef.current = doc
    setEditing(node.id)
    return true
  }, [canWrite, doc])

  const fitToContent = useCallback(() => {
    if (!doc.nodes.length) { setCamera({ x: -300, y: -180, zoom: 1 }); return }
    const minX = Math.min(...doc.nodes.map((n) => Math.min(n.x, n.x + n.width))) - 80
    const minY = Math.min(...doc.nodes.map((n) => Math.min(n.y, n.y + n.height))) - 80
    const maxX = Math.max(...doc.nodes.map((n) => Math.max(n.x, n.x + n.width))) + 80
    const maxY = Math.max(...doc.nodes.map((n) => Math.max(n.y, n.y + n.height))) + 80
    const zoom = Math.max(.15, Math.min(2, Math.min(viewport.width / (maxX - minX), viewport.height / (maxY - minY))))
    setCamera({ x: minX - (viewport.width / zoom - (maxX - minX)) / 2, y: minY - (viewport.height / zoom - (maxY - minY)) / 2, zoom })
  }, [doc.nodes, viewport])

  const zoomToSelection = useCallback(() => {
    const box = selectionBox(doc.nodes.filter((node) => selected.includes(node.id)))
    if (!box) return
    const zoom = Math.max(.15, Math.min(4, Math.min(viewport.width / (box.width + 160), viewport.height / (box.height + 160))))
    setCamera({ x: box.x - (viewport.width / zoom - box.width) / 2, y: box.y - (viewport.height / zoom - box.height) / 2, zoom })
  }, [doc.nodes, selected, viewport])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      const current = cameraRef.current
      if (!event.ctrlKey && !event.metaKey) {
        setCamera({ ...current, x: current.x + event.deltaX / current.zoom, y: current.y + event.deltaY / current.zoom })
        return
      }
      const rect = svg.getBoundingClientRect()
      const beforeX = current.x + (event.clientX - rect.left) / current.zoom
      const beforeY = current.y + (event.clientY - rect.top) / current.zoom
      const zoom = Math.max(.15, Math.min(4, current.zoom * Math.exp(-event.deltaY * .003)))
      setCamera({ zoom, x: beforeX - (event.clientX - rect.left) / zoom, y: beforeY - (event.clientY - rect.top) / zoom })
    }
    svg.addEventListener("wheel", handleWheel, { passive: false })
    return () => svg.removeEventListener("wheel", handleWheel)
  }, [])

  useEffect(() => {
    if (!canWrite) return
    if (!mountedRef.current) { mountedRef.current = true; if (!repairedInitialRef.current) return }
    if (suppressSaveRef.current) { suppressSaveRef.current = false; return }
    if (conflict) return
    const timer = window.setTimeout(() => startTransition(async () => {
      setSaveState("saving")
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await saveWhiteboard(boardId, doc, revisionRef.current)
          if (result.ok) { revisionRef.current = result.revision!; setSaveState("saved"); return }
          if (result.conflict && result.document && result.revision !== undefined) { setConflict({ document: result.document as BoardDocument, revision: result.revision }); setSaveState("error"); return }
        } catch { /* retry transient failures */ }
        await new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** attempt))
      }
      setSaveState("error")
    }), 650)
    return () => window.clearTimeout(timer)
  }, [boardId, canWrite, conflict, doc])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (saveState !== "saved") event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [saveState])

  useRealtime((event) => {
    if (event.type === "whiteboard.update" && event.boardId === boardId && event.revision > revisionRef.current) {
      if (saveState === "saved") { revisionRef.current = event.revision; suppressSaveRef.current = true; setDoc(event.document); setPast([]); setFuture([]) }
      else setConflict({ document: event.document, revision: event.revision })
    }
    if (event.type === "whiteboard.presence" && event.boardId === boardId) setRemoteUsers((current) => {
      const next = new Map(current)
      if (event.x === null || event.y === null) next.delete(event.userId)
      else next.set(event.userId, { name: event.name, x: event.x, y: event.y, selected: event.selected })
      return next
    })
    if (event.type === "whiteboard.comment" && event.boardId === boardId) setComments((current) => current.some((comment) => comment.id === event.comment.id) ? current : [...current, event.comment])
    if (event.type === "whiteboard.comment.resolve" && event.boardId === boardId) setComments((current) => current.filter((comment) => comment.id !== event.commentId))
  })

  useEffect(() => () => { void updateWhiteboardPresence(boardId, { x: null, y: null }, []) }, [boardId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === "Alt") setAltDown(true)
      if (event.code === "Space") { spaceRef.current = true; setSpaceDown(true); event.preventDefault(); return }
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && ["+", "=", "-", "_", "0"].includes(event.key)) {
        event.preventDefault()
        if (event.key === "0") setCamera({ x: -300, y: -180, zoom: 1 })
        else setCamera((current) => ({ ...current, zoom: Math.max(.15, Math.min(4, current.zoom * (event.key === "-" || event.key === "_" ? 1 / 1.2 : 1.2))) }))
        return
      }
      if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (modifier && event.key.toLowerCase() === "g" && canWrite) {
        event.preventDefault()
        if (event.shiftKey) {
          const groups = new Set(doc.nodes.filter((node) => selected.includes(node.id)).map((node) => node.groupId).filter(Boolean))
          if (groups.size) commit({ ...doc, nodes: doc.nodes.map((node) => node.groupId && groups.has(node.groupId) ? { ...node, groupId: undefined } : node) })
        } else if (selected.length > 1) {
          const groupId = id(); commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, groupId } : node) })
        }
        return
      }
      if (modifier && event.key.toLowerCase() === "a") { event.preventDefault(); setSelected(doc.nodes.map((node) => node.id)); return }
      if (modifier && event.key.toLowerCase() === "c" && selected.length) {
        event.preventDefault(); clipboardRef.current = doc.nodes.filter((node) => selected.includes(node.id)).map((node) => ({ ...node }))
        sessionStorage.setItem("klyron-whiteboard-clipboard", JSON.stringify(clipboardRef.current)); return
      }
      if (modifier && event.key.toLowerCase() === "x" && selected.length && canWrite) {
        event.preventDefault(); clipboardRef.current = doc.nodes.filter((node) => selected.includes(node.id)).map((node) => ({ ...node }))
        sessionStorage.setItem("klyron-whiteboard-clipboard", JSON.stringify(clipboardRef.current))
        commit({ ...doc, nodes: doc.nodes.filter((node) => !selected.includes(node.id)) }); setSelected([]); return
      }
      if (modifier && event.key.toLowerCase() === "v" && canWrite) {
        event.preventDefault()
        if (!clipboardRef.current.length) {
          try { clipboardRef.current = JSON.parse(sessionStorage.getItem("klyron-whiteboard-clipboard") ?? "[]") as BoardNode[] } catch { clipboardRef.current = [] }
        }
        const copies = duplicateNodes(clipboardRef.current)
        if (copies.length) { clipboardRef.current = copies; commit({ ...doc, nodes: [...doc.nodes, ...copies] }); setSelected(copies.map((node) => node.id)) }
        return
      }
      if (modifier && event.key.toLowerCase() === "d" && selected.length && canWrite) {
        event.preventDefault(); const copies = duplicateNodes(doc.nodes.filter((item) => selected.includes(item.id)))
        commit({ ...doc, nodes: [...doc.nodes, ...copies] }); setSelected(copies.map((node) => node.id))
        return
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selected.length && canWrite) { event.preventDefault(); commit({ ...doc, nodes: doc.nodes.filter((node) => !selected.includes(node.id)) }); setSelected([]); return }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selected.length && canWrite) {
        event.preventDefault(); const amount = event.shiftKey ? 10 : 1
        const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0
        const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0
        commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node) }); return
      }
      if (event.key === "Enter" && selected.length === 1) {
        const node = doc.nodes.find((item) => item.id === selected[0])
        if (node && beginEditing(node)) event.preventDefault()
        return
      }
      if (event.key === "Escape") { setSelected([]); setEditing(null); setTool(canWrite ? "select" : "hand"); return }
      if (event.key === "1" && event.shiftKey) { event.preventDefault(); fitToContent() }
      if (event.key === "2" && event.shiftKey) { event.preventDefault(); zoomToSelection() }
      const chosen = tools.find((item) => item.key.toLowerCase() === event.key.toLowerCase())
      if (chosen && (canWrite || chosen.id === "hand" || chosen.id === "select")) setTool(chosen.id)
    }
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") { spaceRef.current = false; setSpaceDown(false) }; if (event.key === "Alt") setAltDown(false) }
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp)
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp) }
  }, [beginEditing, canWrite, commit, doc, fitToContent, redo, selected, undo, zoomToSelection])

  function point(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: camera.x + (event.clientX - rect.left) / camera.zoom, y: camera.y + (event.clientY - rect.top) / camera.zoom }
  }

  function onCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return
    if (event.pointerType === "touch") {
      touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      event.currentTarget.setPointerCapture(event.pointerId)
      const touches = [...touchesRef.current.values()]
      if (touches.length === 2) {
        const rect = event.currentTarget.getBoundingClientRect(); const middle = { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 }
        pinchRef.current = { distance: Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y), zoom: camera.zoom, worldX: camera.x + (middle.x - rect.left) / camera.zoom, worldY: camera.y + (middle.y - rect.top) / camera.zoom }
        dragRef.current = null
      }
      if (touches.length > 1) return
    }
    const p = point(event)
    if (tool === "hand" || spaceRef.current || event.button === 1) {
      event.preventDefault()
      dragRef.current = { kind: "pan", startX: event.clientX, startY: event.clientY, originX: camera.x, originY: camera.y }
      event.currentTarget.setPointerCapture(event.pointerId); return
    }
    if (tool === "comment") { setCommentDraft(p); setCommentsOpen(true); setTool("select"); return }
    if (tool !== "select" && canWrite) {
      const node = newNode(tool, p.x, p.y)
      setDoc({ ...doc, nodes: [...doc.nodes, node] }); setSelected([node.id])
      dragRef.current = { kind: "draw", id: node.id, type: node.type, startX: p.x, startY: p.y, before: doc }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    dragRef.current = { kind: "marquee", startX: p.x, startY: p.y, additive: event.shiftKey, intersect: event.altKey }
    setMarquee({ x: p.x, y: p.y, width: 0, height: 0 })
    if (!event.shiftKey) setSelected([])
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onNodePointerDown(event: ReactPointerEvent, node: BoardNode) {
    // Only primary-click moves objects. Middle-click and Space + primary-click
    // intentionally bubble to the SVG canvas so they always pan the viewport.
    if (event.button !== 0 || tool === "hand" || spaceRef.current || !canWrite) return
    event.stopPropagation(); const p = point(event)
    if (selected.includes(node.id) && !event.shiftKey && beginEditing(node)) return
    if (node.locked) { setSelected(expandGroupedSelection([node.id], doc.nodes)); return }
    if (event.altKey) {
      const stacked = doc.nodes.filter((item) => { const box = nodeBox(item); return p.x >= box.x - 7 && p.x <= box.x + box.width + 7 && p.y >= box.y - 7 && p.y <= box.y + box.height + 7 }).reverse()
      const current = stacked.findIndex((item) => selected.includes(item.id))
      const next = stacked[(current + 1) % stacked.length]
      if (next) setSelected(expandGroupedSelection([next.id], doc.nodes))
      return
    }
    const clicked = expandGroupedSelection([node.id], doc.nodes)
    let ids = selected
    if (event.shiftKey) {
      ids = selected.includes(node.id) ? selected.filter((value) => !clicked.includes(value)) : [...new Set([...selected, ...clicked])]
      setSelected(ids)
      if (!ids.includes(node.id)) return
    } else if (!selected.includes(node.id)) {
      ids = clicked; setSelected(ids)
    }
    dragRef.current = { kind: "move", ids, startX: p.x, startY: p.y, before: doc }
    svgRef.current?.setPointerCapture(event.pointerId)
  }

  function startConnector(event: ReactPointerEvent<SVGCircleElement>, node: BoardNode, side: ConnectionSide) {
    if (!canWrite) return
    event.stopPropagation()
    const start = connectionPoint(node, side)
    const connector = { ...newNode("line", start.x, start.y), width: 1, height: 1, startId: node.id, startSide: side }
    setDoc({ ...doc, nodes: [...doc.nodes, connector] }); setSelected([connector.id])
    dragRef.current = { kind: "draw", id: connector.id, type: "line", startX: start.x, startY: start.y, before: doc }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
  }

  function startEndpointDrag(event: ReactPointerEvent<SVGCircleElement>, node: BoardNode, endpoint: "start" | "end") {
    event.stopPropagation()
    dragRef.current = { kind: "endpoint", id: node.id, endpoint, before: doc }
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
  }

  function nearestPort(p: { x: number; y: number }, nodes: BoardNode[], connectorId: string) {
    let nearest: { nodeId: string; side: ConnectionSide; distance: number } | null = null
    for (const node of nodes) {
      if (node.id === connectorId || node.type === "line") continue
      for (const side of ["top", "right", "bottom", "left"] as const) {
        const target = connectionPoint(node, side); const distance = Math.hypot(target.x - p.x, target.y - p.y)
        if (distance <= 20 / camera.zoom && (!nearest || distance < nearest.distance)) nearest = { nodeId: node.id, side, distance }
      }
    }
    return nearest
  }

  function onResizePointerDown(event: ReactPointerEvent<SVGCircleElement>, handle: ResizeHandle, bounds: Box) {
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const p = { x: camera.x + (event.clientX - rect.left) / camera.zoom, y: camera.y + (event.clientY - rect.top) / camera.zoom }
    dragRef.current = { kind: "resize", ids: selected, handle, bounds, startX: p.x, startY: p.y, before: doc }
    svg.setPointerCapture(event.pointerId)
  }

  function onRotatePointerDown(event: ReactPointerEvent<SVGCircleElement>, bounds: Box) {
    event.stopPropagation()
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect(); const p = { x: camera.x + (event.clientX - rect.left) / camera.zoom, y: camera.y + (event.clientY - rect.top) / camera.zoom }
    const centerX = bounds.x + bounds.width / 2; const centerY = bounds.y + bounds.height / 2
    dragRef.current = { kind: "rotate", ids: selected, centerX, centerY, startAngle: Math.atan2(p.y - centerY, p.x - centerX), before: doc }
    svg.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    pendingPointerRef.current = event
    if (pointerFrameRef.current !== null) return
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = null
      const pending = pendingPointerRef.current
      pendingPointerRef.current = null
      if (pending) processPointerMove(pending)
    })
  }

  function processPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) {
      touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const touches = [...touchesRef.current.values()]; const pinch = pinchRef.current
      if (touches.length === 2 && pinch) {
        const rect = event.currentTarget.getBoundingClientRect(); const middle = { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 }
        const zoom = Math.max(.15, Math.min(4, pinch.zoom * Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y) / pinch.distance))
        setCamera({ zoom, x: pinch.worldX - (middle.x - rect.left) / zoom, y: pinch.worldY - (middle.y - rect.top) / zoom }); return
      }
    }
    const cursorPoint = point(event)
    if (event.timeStamp - presenceAtRef.current > 120) { presenceAtRef.current = event.timeStamp; void updateWhiteboardPresence(boardId, cursorPoint, selected) }
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === "pan") { setCamera((c) => ({ ...c, x: drag.originX - (event.clientX - drag.startX) / c.zoom, y: drag.originY - (event.clientY - drag.startY) / c.zoom })); return }
    const p = cursorPoint
    if (drag.kind === "marquee") { setMarquee(dragBox(drag.startX, drag.startY, p.x, p.y)); return }
    if (drag.kind === "draw") {
      setDoc((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== drag.id ? node : drag.type === "line" ? { ...node, width: p.x - drag.startX || .1, height: p.y - drag.startY || .1 } : { ...node, ...dragBox(drag.startX, drag.startY, p.x, p.y), width: Math.max(1, Math.abs(p.x - drag.startX)), height: Math.max(1, Math.abs(p.y - drag.startY)) }) }))
      return
    }
    if (drag.kind === "endpoint") {
      const original = drag.before.nodes.find((node) => node.id === drag.id)
      if (!original) return
      const points = connectorPoints(original, drag.before.nodes)
      setDoc((current) => ({ ...current, nodes: current.nodes.map((node) => {
        if (node.id !== drag.id) return node
        if (drag.endpoint === "start") return { ...node, x: p.x, y: p.y, width: points.end.x - p.x, height: points.end.y - p.y, startId: undefined, startSide: undefined }
        return { ...node, x: points.start.x, y: points.start.y, width: p.x - points.start.x, height: p.y - points.start.y, endId: undefined, endSide: undefined }
      }) }))
      return
    }
    if (drag.kind === "move") {
      const moving = selectionBox(drag.before.nodes.filter((node) => drag.ids.includes(node.id)))
      const others = drag.before.nodes.filter((node) => !drag.ids.includes(node.id)).map(nodeBox)
      const snapped = moving ? snapTranslation(moving, others, p.x - drag.startX, p.y - drag.startY, 6 / camera.zoom) : { x: p.x - drag.startX, y: p.y - drag.startY }
      if (gridSnap && moving && snapped.guideX === undefined) snapped.x += Math.round((moving.x + snapped.x) / 24) * 24 - (moving.x + snapped.x)
      if (gridSnap && moving && snapped.guideY === undefined) snapped.y += Math.round((moving.y + snapped.y) / 24) * 24 - (moving.y + snapped.y)
      setGuides({ x: snapped.guideX, y: snapped.guideY })
      setDoc({ ...drag.before, nodes: drag.before.nodes.map((node) => drag.ids.includes(node.id) ? { ...node, x: node.x + snapped.x, y: node.y + snapped.y } : node) })
      return
    }
    if (drag.kind === "rotate") {
      let degrees = (Math.atan2(p.y - drag.centerY, p.x - drag.centerX) - drag.startAngle) * 180 / Math.PI
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15
      setDoc({ ...drag.before, nodes: drag.before.nodes.map((node) => {
        if (!drag.ids.includes(node.id)) return node
        const center = rotatePoint({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, { x: drag.centerX, y: drag.centerY }, degrees)
        return { ...node, x: center.x - node.width / 2, y: center.y - node.height / 2, rotation: (node.rotation ?? 0) + degrees }
      }) })
      return
    }
    const next = resizeBox(drag.bounds, drag.handle, p.x, p.y, event.shiftKey, event.altKey)
    if (next.width < 4 || next.height < 4) return
    const sx = next.width / drag.bounds.width; const sy = next.height / drag.bounds.height
    setDoc({ ...drag.before, nodes: drag.before.nodes.map((node) => {
      if (!drag.ids.includes(node.id)) return node
      const x = next.x + (node.x - drag.bounds.x) * sx; const y = next.y + (node.y - drag.bounds.y) * sy
      return { ...node, x, y, width: node.width * sx, height: node.height * sy }
    }) })
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current)
    pointerFrameRef.current = null
    const pending = pendingPointerRef.current
    pendingPointerRef.current = null
    if (pending) processPointerMove(pending)
    if (event.pointerType === "touch") { touchesRef.current.delete(event.pointerId); if (touchesRef.current.size < 2) pinchRef.current = null }
    const drag = dragRef.current
    if (drag?.kind === "marquee") {
      const box = marquee
      if (box && (box.width > 3 || box.height > 3)) {
        const hits = doc.nodes.filter((node) => {
          const b = nodeBox(node)
          return drag.intersect
            ? b.x <= box.x + box.width && b.x + b.width >= box.x && b.y <= box.y + box.height && b.y + b.height >= box.y
            : b.x >= box.x && b.x + b.width <= box.x + box.width && b.y >= box.y && b.y + b.height <= box.y + box.height
        }).map((node) => node.id)
        const expanded = expandGroupedSelection(hits, doc.nodes)
        setSelected((current) => drag.additive ? [...new Set([...current, ...expanded])] : expanded)
      }
      setMarquee(null)
    }
    if (drag?.kind === "draw") {
      const end = point(event)
      setDoc((current) => {
        const node = current.nodes.find((item) => item.id === drag.id)
        if (!node) return current
        if (node.type === "line") {
          const target = nearestPort(end, current.nodes, node.id)
          return target ? { ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, endId: target.nodeId, endSide: target.side } : item) } : current
        }
        return Math.abs(node.width) < 5 && Math.abs(node.height) < 5 ? { ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...newNode(drag.type, drag.startX, drag.startY), id: node.id } : item) } : current
      })
      if (drag.type === "text" || drag.type === "sticky") { editBeforeRef.current = drag.before; setEditing(drag.id) }
      setPast((items) => [...items.slice(-49), drag.before]); setFuture([]); setTool("select")
    }
    if (drag?.kind === "endpoint") {
      const target = nearestPort(point(event), doc.nodes, drag.id)
      if (target) setDoc((current) => ({ ...current, nodes: current.nodes.map((item) => item.id !== drag.id ? item : drag.endpoint === "start" ? { ...item, startId: target.nodeId, startSide: target.side } : { ...item, endId: target.nodeId, endSide: target.side }) }))
    }
    if (drag?.kind === "move" || drag?.kind === "resize" || drag?.kind === "rotate" || drag?.kind === "endpoint") { setPast((items) => [...items.slice(-49), drag.before]); setFuture([]) }
    dragRef.current = null
    setGuides({})
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function updateNode(nodeId: string, patch: Partial<BoardNode>) {
    commit({ ...doc, nodes: doc.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) })
  }

  function align(alignment: Alignment) {
    commit({ ...doc, nodes: alignSelection(doc.nodes, selected, alignment) })
  }

  function distribute(distribution: Distribution) {
    commit({ ...doc, nodes: distributeSelection(doc.nodes, selected, distribution) })
  }

  function groupSelection() {
    if (selected.length < 2) return
    const groupId = id()
    commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, groupId } : node) })
  }

  function ungroupSelection() {
    const groups = new Set(doc.nodes.filter((node) => selected.includes(node.id)).map((node) => node.groupId).filter(Boolean))
    if (groups.size) commit({ ...doc, nodes: doc.nodes.map((node) => node.groupId && groups.has(node.groupId) ? { ...node, groupId: undefined } : node) })
  }

  function selectLayer(ids: string[], additive: boolean) {
    setTool("select")
    setSelected((current) => additive ? current.some((value) => ids.includes(value)) ? current.filter((value) => !ids.includes(value)) : [...new Set([...current, ...ids])] : ids)
  }

  function removeSelection() {
    if (!canWrite || !selected.length) return
    commit({ ...doc, nodes: doc.nodes.filter((node) => !selected.includes(node.id)) })
    setSelected([])
    setContextMenu(null)
  }

  function duplicateSelection() {
    if (!canWrite || !selected.length) return
    const copies = duplicateNodes(doc.nodes.filter((node) => selected.includes(node.id)))
    commit({ ...doc, nodes: [...doc.nodes, ...copies] })
    setSelected(copies.map((node) => node.id))
    setContextMenu(null)
  }

  function openContextMenu(event: ReactMouseEvent, node?: BoardNode) {
    event.preventDefault()
    event.stopPropagation()
    if (node && !selected.includes(node.id)) setSelected(expandGroupedSelection([node.id], doc.nodes))
    else if (!node) setSelected([])
    const canvasPoint = point(event)
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 330), canvasX: canvasPoint.x, canvasY: canvasPoint.y })
  }

  function reorder(mode: "front" | "forward" | "backward" | "back") {
    const picked = doc.nodes.filter((node) => selected.includes(node.id)); const rest = doc.nodes.filter((node) => !selected.includes(node.id))
    if (mode === "front") return commit({ ...doc, nodes: [...rest, ...picked] })
    if (mode === "back") return commit({ ...doc, nodes: [...picked, ...rest] })
    const nodes = [...doc.nodes]
    if (mode === "forward") for (let i = nodes.length - 2; i >= 0; i--) if (selected.includes(nodes[i].id) && !selected.includes(nodes[i + 1].id)) [nodes[i], nodes[i + 1]] = [nodes[i + 1], nodes[i]]
    else for (let i = 1; i < nodes.length; i++) if (selected.includes(nodes[i].id) && !selected.includes(nodes[i - 1].id)) [nodes[i], nodes[i - 1]] = [nodes[i - 1], nodes[i]]
    commit({ ...doc, nodes })
  }

  function setNumeric(property: "x" | "y" | "width" | "height", value: string) {
    if (!selectedNode) return
    const number = Number(value); if (!Number.isFinite(number) || ((property === "width" || property === "height") && number === 0)) return
    updateNode(selectedNode.id, { [property]: number })
  }

  function zoomBy(factor: number) {
    setCamera((current) => {
      const zoom = Math.max(.15, Math.min(4, current.zoom * factor))
      const centerX = current.x + viewport.width / current.zoom / 2; const centerY = current.y + viewport.height / current.zoom / 2
      return { zoom, x: centerX - viewport.width / zoom / 2, y: centerY - viewport.height / zoom / 2 }
    })
  }

  const renderNodes = doc.nodes.map((node) => node.type === "line" ? (() => { const points = connectorPoints(node, doc.nodes); return { ...node, x: points.start.x, y: points.start.y, width: points.end.x - points.start.x, height: points.end.y - points.start.y } })() : node)
  const visibleNodes = renderNodes.filter((node) => !node.hidden || showHidden)
  const selectedNodes = renderNodes.filter((node) => selected.includes(node.id))
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const bounds = selectionBox(selectedNodes)
  const hasGroupedSelection = selectedNodes.some((node) => node.groupId)
  const gridSize = camera.zoom < .4 ? 96 : camera.zoom < .75 ? 48 : 24
  const contentBounds = selectionBox(renderNodes.filter((node) => !node.hidden))
  const measurements = altDown && bounds ? nearestDistances(bounds, renderNodes.filter((node) => !selected.includes(node.id) && !node.hidden).map(nodeBox)) : []
  const cursor = tool === "hand" || spaceDown ? "cursor-grab active:cursor-grabbing" : tool === "select" ? "cursor-default" : "cursor-crosshair"
  const layerGroups = new Map<string, BoardNode[]>()
  for (const node of [...doc.nodes].reverse()) if (node.groupId) layerGroups.set(node.groupId, [...(layerGroups.get(node.groupId) ?? []), node])
  const shownGroups = new Set<string>()
  const layerRows: LayerItem[] = []
  for (const node of [...doc.nodes].reverse()) {
    if (!node.groupId) layerRows.push({ kind: "node", node })
    else if (!shownGroups.has(node.groupId)) { shownGroups.add(node.groupId); layerRows.push({ kind: "group", id: node.groupId, nodes: layerGroups.get(node.groupId) ?? [] }) }
  }

  return (
    <div className="relative h-svh min-h-[560px] w-screen overflow-hidden overscroll-none bg-[#f7f7f7]" onPointerDown={() => contextMenu && setContextMenu(null)} onContextMenu={(event) => openContextMenu(event)} onDragStart={(event) => event.preventDefault()}>
      {conflict && <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm shadow-xl"><span>This board changed in another session.</span><button className="font-medium underline" onClick={() => { revisionRef.current = conflict.revision; suppressSaveRef.current = true; setDoc(conflict.document); setConflict(null); setSaveState("saved") }}>Load theirs</button><button className="font-medium underline" onClick={() => { revisionRef.current = conflict.revision; setConflict(null); setSaveState("saving") }}>Keep mine</button></div>}
      <header className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          <Link href="/whiteboard" aria-label="Back to whiteboards" className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ArrowLeftIcon className="size-4" /></Link>
          <span className="h-5 w-px bg-border" />
          <input value={name} readOnly={!canWrite} aria-label="Board name" onChange={(e) => setName(e.target.value)} onBlur={() => canWrite && startTransition(async () => { const result = await renameWhiteboard(boardId, name); if (!result.ok) setName(initialName) })} className="w-40 bg-transparent px-1 text-sm font-medium outline-none sm:w-64" />
          <span className={cn("pr-2 text-[11px]", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>{isPending || saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : canWrite ? "Saved" : "View only"}</span>
          <button aria-label="Toggle layers" title="Layers" onClick={() => setLayersOpen((value) => !value)} className={cn("grid size-8 place-items-center rounded-lg hover:bg-muted", layersOpen && "bg-muted")}><Layers3Icon className="size-4" /></button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {[...remoteUsers.entries()].map(([userId, user]) => <span key={userId} title={user.name} className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-white ring-2 ring-white">{user.name.slice(0, 1).toUpperCase()}</span>)}
          <div className="hidden rounded-lg border border-black/10 bg-white/95 px-3 py-2 text-xs text-muted-foreground shadow-md sm:block">Space to pan · Ctrl/⌘ + wheel to zoom</div>
          <button className="grid size-9 place-items-center rounded-lg border border-black/10 bg-white shadow-md hover:bg-muted" title="Comments" onClick={() => setCommentsOpen((value) => !value)}><MessageCircleIcon className="size-4" /></button>
          {canManage && <button className="grid size-9 place-items-center rounded-lg border border-black/10 bg-white shadow-md hover:bg-muted" title="Share board" onClick={() => setShareOpen((value) => !value)}><Share2Icon className="size-4" /></button>}
        </div>
      </header>

      {layersOpen && <aside className="absolute bottom-16 left-3 top-16 z-30 flex w-60 flex-col overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b px-3 py-2"><h2 className="text-sm font-semibold">Layers</h2><span className="text-[11px] text-muted-foreground">{doc.nodes.length} objects</span></div>
        <div className="flex-1 overflow-y-auto p-1.5">{layerRows.length ? layerRows.map((row) => {
          if (row.kind === "node") return <LayerRow key={row.node.id} node={row.node} active={selected.includes(row.node.id)} canWrite={canWrite} onSelect={(additive) => selectLayer([row.node.id], additive)} onUpdate={(patch) => updateNode(row.node.id, patch)} />
          const collapsed = collapsedGroups.has(row.id), active = row.nodes.every((node) => selected.includes(node.id))
          return <div key={row.id} className="mb-0.5"><div className={cn("group/layer flex h-8 items-center rounded-md text-xs hover:bg-muted", active && "bg-primary/10 text-primary")}><button aria-label={collapsed ? "Expand group" : "Collapse group"} className="grid size-7 shrink-0 place-items-center" onClick={() => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next })}>{collapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}</button><button className="min-w-0 flex-1 truncate text-left font-medium" onClick={(event) => selectLayer(row.nodes.map((node) => node.id), event.shiftKey)}>Group · {row.nodes.length}</button></div>{!collapsed && <div className="ml-4 border-l pl-1">{row.nodes.map((node) => <LayerRow key={node.id} node={node} active={selected.includes(node.id)} canWrite={canWrite} onSelect={(additive) => selectLayer([node.id], additive)} onUpdate={(patch) => updateNode(node.id, patch)} />)}</div>}</div>
        }) : <p className="px-2 py-6 text-center text-xs text-muted-foreground">Objects appear here as you add them.</p>}</div>
        {canWrite && <div className="flex gap-1 border-t p-2"><button disabled={selected.length < 2 || hasGroupedSelection} onClick={groupSelection} className="flex-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium disabled:opacity-40">Group</button><button disabled={!hasGroupedSelection} onClick={ungroupSelection} className="flex-1 rounded-md bg-muted px-2 py-1.5 text-xs font-medium disabled:opacity-40">Ungroup</button></div>}
      </aside>}

      <svg ref={svgRef} aria-label="Whiteboard canvas" className={cn("size-full touch-none select-none", cursor)} viewBox={`${camera.x} ${camera.y} ${Math.max(1, viewport.width / camera.zoom)} ${Math.max(1, viewport.height / camera.zoom)}`} onPointerDown={onCanvasPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <defs>
          <pattern id="dots" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r={Math.max(1, 1 / camera.zoom)} fill="#c8c8c8" /></pattern>
          <marker id="connector-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker>
        </defs>
        <rect x={camera.x - 10000} y={camera.y - 10000} width="30000" height="30000" fill="url(#dots)" />
        {/* eslint-disable-next-line react-hooks/refs -- pointer handlers touch refs only after user input, never during render */}
        {visibleNodes.map((node) => {
          const active = selected.includes(node.id)
          if (node.type === "line") {
            const endX = node.x + node.width; const endY = node.y + node.height; const midX = node.x + node.width / 2
            const path = node.lineStyle === "elbow" ? `M ${node.x} ${node.y} H ${midX} V ${endY} H ${endX}` : `M ${node.x} ${node.y} L ${endX} ${endY}`
            const dash = node.strokeStyle === "dashed" ? "10 7" : node.strokeStyle === "dotted" ? "2 6" : undefined
            return <g key={node.id} opacity={node.hidden ? .25 : 1} className={tool === "select" ? node.locked ? "cursor-not-allowed" : "cursor-move" : undefined} onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)} onPointerDown={(e) => onNodePointerDown(e, node)} onContextMenu={(event) => openContextMenu(event, node)}>
              <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
              <path d={path} fill="none" stroke={active || hovered === node.id ? "#2563eb" : node.stroke} strokeWidth={active ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} markerEnd={node.endArrow ? "url(#connector-arrow)" : undefined} />
              {active && canWrite && <>
                <circle cx={node.x} cy={node.y} r={7 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-crosshair" onPointerDown={(event) => startEndpointDrag(event, node, "start")} />
                <circle cx={endX} cy={endY} r={7 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-crosshair" onPointerDown={(event) => startEndpointDrag(event, node, "end")} />
              </>}
            </g>
          }
          const transform = node.rotation ? `rotate(${node.rotation} ${node.x + node.width / 2} ${node.y + node.height / 2})` : undefined
          return (
            <g key={node.id} opacity={node.hidden ? .25 : 1} className={tool === "select" ? node.locked ? "cursor-not-allowed" : "cursor-move" : undefined} onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)} onPointerDown={(e) => onNodePointerDown(e, node)} onDoubleClick={(e) => { e.stopPropagation(); beginEditing(node) }} onContextMenu={(event) => openContextMenu(event, node)}>
              {node.type === "ellipse" ? <ellipse transform={transform} cx={node.x + node.width / 2} cy={node.y + node.height / 2} rx={node.width / 2} ry={node.height / 2} fill={node.fill} stroke={active || hovered === node.id ? "#2563eb" : node.stroke} strokeWidth="2" /> : node.type === "text" ? null : <rect transform={transform} x={node.x} y={node.y} width={node.width} height={node.height} rx={node.type === "sticky" ? 4 : 10} fill={node.fill} stroke={active || hovered === node.id ? "#2563eb" : node.stroke} strokeWidth="2" className={node.type === "sticky" ? "drop-shadow-sm" : ""} />}
              {(node.type === "text" || node.type === "sticky") && <foreignObject transform={transform} x={node.x} y={node.y} width={node.width} height={node.height} className="overflow-visible">
                {editing === node.id ? <textarea autoFocus placeholder={node.type === "sticky" ? "Write a note…" : "Type something"} value={node.text} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) { event.preventDefault(); event.currentTarget.blur() } }} onChange={(e) => { const text = e.target.value; setDoc((current) => ({ ...current, nodes: current.nodes.map((n) => n.id === node.id ? { ...n, text, height: n.type === "sticky" ? Math.max(n.height, stickyHeight(text, n.width, n.fontSize ?? 16)) : n.height } : n) })) }} onBlur={() => { if (editBeforeRef.current && editBeforeRef.current !== doc) { setPast((items) => [...items.slice(-49), editBeforeRef.current!]); setFuture([]) }; editBeforeRef.current = null; setEditing(null) }} className={cn("size-full resize-none border-0 bg-transparent p-3 leading-snug outline-none placeholder:text-black/35", node.type === "text" && "p-0")} style={{ fontSize: node.fontSize ?? (node.type === "text" ? 18 : 16), fontWeight: node.fontWeight ?? "normal", textAlign: node.textAlign ?? "left", color: node.textColor ?? "#1d1d1f" }} /> : <div className={cn("flex size-full whitespace-pre-wrap break-words p-3 leading-snug", node.type === "text" && "items-center p-0")} style={{ fontSize: node.fontSize ?? (node.type === "text" ? 18 : 16), fontWeight: node.fontWeight ?? "normal", textAlign: node.textAlign ?? "left", color: node.textColor ?? "#1d1d1f" }}>{node.text}</div>}
              </foreignObject>}
              {node.type === "text" && hovered === node.id && !active && <rect transform={transform} x={node.x - 2} y={node.y - 2} width={node.width + 4} height={node.height + 4} fill="none" stroke="#2563eb" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
              {tool === "line" && (hovered === node.id || selectedNode?.type === "line") && (["top", "right", "bottom", "left"] as const).map((side) => { const port = connectionPoint(node, side); return <circle key={side} cx={port.x} cy={port.y} r={7 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-crosshair" onPointerDown={(event) => startConnector(event, node, side)} /> })}
            </g>
          )
        })}
        {marquee && <rect {...marquee} fill="#2563eb18" stroke="#2563eb" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {guides.x !== undefined && <line x1={guides.x} y1={camera.y} x2={guides.x} y2={camera.y + viewport.height / camera.zoom} stroke="#e11d48" strokeWidth={1 / camera.zoom} strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`} pointerEvents="none" />}
        {guides.y !== undefined && <line x1={camera.x} y1={guides.y} x2={camera.x + viewport.width / camera.zoom} y2={guides.y} stroke="#e11d48" strokeWidth={1 / camera.zoom} strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`} pointerEvents="none" />}
        {measurements.map((measure, index) => measure.axis === "x" ? <g key={`m${index}`} pointerEvents="none"><line x1={measure.from} y1={measure.cross} x2={measure.to} y2={measure.cross} stroke="#dc143c" strokeWidth={1 / camera.zoom} /><text x={(measure.from + measure.to) / 2} y={measure.cross - 5 / camera.zoom} textAnchor="middle" fontSize={11 / camera.zoom} fill="#dc143c">{Math.round(measure.distance)}</text></g> : <g key={`m${index}`} pointerEvents="none"><line x1={measure.cross} y1={measure.from} x2={measure.cross} y2={measure.to} stroke="#dc143c" strokeWidth={1 / camera.zoom} /><text x={measure.cross + 5 / camera.zoom} y={(measure.from + measure.to) / 2} fontSize={11 / camera.zoom} fill="#dc143c">{Math.round(measure.distance)}</text></g>)}
        {[...remoteUsers.entries()].filter(([, user]) => user.x !== null && user.y !== null).map(([userId, user]) => <g key={userId} pointerEvents="none"><path d={`M ${user.x!} ${user.y!} l 4 14 4 -6 7 -2 z`} fill="#dc143c" stroke="white" strokeWidth={1 / camera.zoom} /><text x={user.x! + 12 / camera.zoom} y={user.y! + 18 / camera.zoom} fontSize={12 / camera.zoom} fill="#dc143c" fontWeight="600">{user.name}</text></g>)}
        {[...remoteUsers.entries()].flatMap(([userId, user]) => user.selected.map((nodeId) => renderNodes.find((node) => node.id === nodeId)).filter(Boolean).map((node) => ({ userId, user, node: node! }))).map(({ userId, user, node }) => { const box = nodeBox(node); return <g key={`${userId}:${node.id}`} pointerEvents="none"><rect x={box.x - 3} y={box.y - 3} width={box.width + 6} height={box.height + 6} fill="none" stroke="#dc143c" strokeWidth={1.5 / camera.zoom} strokeDasharray={`${4 / camera.zoom} ${3 / camera.zoom}`} /><text x={box.x} y={box.y - 7 / camera.zoom} fontSize={10 / camera.zoom} fill="#dc143c">{user.name}</text></g> })}
        {comments.map((comment, index) => <g key={comment.id} className="cursor-pointer" onPointerDown={(event) => { event.stopPropagation(); setCommentsOpen(true) }}><circle cx={comment.x} cy={comment.y} r={12 / camera.zoom} fill="#dc143c" stroke="white" strokeWidth={2 / camera.zoom} /><text x={comment.x} y={comment.y + 4 / camera.zoom} textAnchor="middle" fontSize={11 / camera.zoom} fontWeight="700" fill="white">{index + 1}</text></g>)}
        {bounds && <g>
          <rect x={bounds.x - 4} y={bounds.y - 4} width={bounds.width + 8} height={bounds.height + 8} rx="3" fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {canWrite && selectedNodes.every((node) => node.type !== "line") && <>
            <line x1={bounds.x + bounds.width / 2} y1={bounds.y - 4} x2={bounds.x + bounds.width / 2} y2={bounds.y - 34 / camera.zoom} stroke="#2563eb" strokeWidth={1 / camera.zoom} />
            <circle cx={bounds.x + bounds.width / 2} cy={bounds.y - 38 / camera.zoom} r={7 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => onRotatePointerDown(event, bounds)} />
          </>}
          {canWrite && selectedNode?.type !== "line" && <>
            <circle cx={bounds.x - 4} cy={bounds.y - 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-nwse-resize" onPointerDown={(event) => onResizePointerDown(event, "nw", bounds)} />
            <circle cx={bounds.x + bounds.width / 2} cy={bounds.y - 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-ns-resize" onPointerDown={(event) => onResizePointerDown(event, "n", bounds)} />
            <circle cx={bounds.x + bounds.width + 4} cy={bounds.y - 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-nesw-resize" onPointerDown={(event) => onResizePointerDown(event, "ne", bounds)} />
            <circle cx={bounds.x + bounds.width + 4} cy={bounds.y + bounds.height / 2} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-ew-resize" onPointerDown={(event) => onResizePointerDown(event, "e", bounds)} />
            <circle cx={bounds.x + bounds.width + 4} cy={bounds.y + bounds.height + 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-nwse-resize" onPointerDown={(event) => onResizePointerDown(event, "se", bounds)} />
            <circle cx={bounds.x + bounds.width / 2} cy={bounds.y + bounds.height + 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-ns-resize" onPointerDown={(event) => onResizePointerDown(event, "s", bounds)} />
            <circle cx={bounds.x - 4} cy={bounds.y + bounds.height + 4} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-nesw-resize" onPointerDown={(event) => onResizePointerDown(event, "sw", bounds)} />
            <circle cx={bounds.x - 4} cy={bounds.y + bounds.height / 2} r={6 / camera.zoom} fill="white" stroke="#2563eb" strokeWidth={2 / camera.zoom} className="cursor-ew-resize" onPointerDown={(event) => onResizePointerDown(event, "w", bounds)} />
          </>}
        </g>}
      </svg>

      {contextMenu && <div role="menu" aria-label="Canvas menu" className="fixed z-50 w-52 rounded-lg border border-black/10 bg-white p-1.5 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        {selected.length ? <>
          {selectedNode && (selectedNode.type === "text" || selectedNode.type === "sticky") && <MenuItem label="Edit text" shortcut="Enter" onClick={() => { beginEditing(selectedNode); setContextMenu(null) }} />}
          <MenuItem label="Duplicate" shortcut="Ctrl/⌘ D" disabled={!canWrite} onClick={duplicateSelection} />
          <div className="my-1 border-t" />
          {selected.length > 1 && !hasGroupedSelection && <MenuItem label="Group selection" shortcut="Ctrl/⌘ G" disabled={!canWrite} onClick={() => { groupSelection(); setContextMenu(null) }} />}
          {hasGroupedSelection && <MenuItem label="Ungroup" shortcut="⇧ Ctrl/⌘ G" disabled={!canWrite} onClick={() => { ungroupSelection(); setContextMenu(null) }} />}
          <MenuItem label="Bring to front" disabled={!canWrite} onClick={() => { reorder("front"); setContextMenu(null) }} />
          <MenuItem label="Send to back" disabled={!canWrite} onClick={() => { reorder("back"); setContextMenu(null) }} />
          <MenuItem label={selectedNodes.every((node) => node.locked) ? "Unlock" : "Lock"} disabled={!canWrite} onClick={() => { commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, locked: !selectedNodes.every((item) => item.locked) } : node) }); setContextMenu(null) }} />
          <MenuItem label={selectedNodes.every((node) => node.hidden) ? "Show" : "Hide"} disabled={!canWrite} onClick={() => { commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, hidden: !node.hidden } : node) }); setContextMenu(null) }} />
          <div className="my-1 border-t" /><MenuItem label="Delete" shortcut="Del" danger disabled={!canWrite} onClick={removeSelection} />
        </> : <>
          <MenuItem label="Select all" shortcut="Ctrl/⌘ A" onClick={() => { setSelected(doc.nodes.filter((node) => !node.hidden).map((node) => node.id)); setContextMenu(null) }} />
          <MenuItem label="Paste" shortcut="Ctrl/⌘ V" disabled={!canWrite} onClick={() => { const copies = duplicateNodes(clipboardRef.current).map((node, index) => ({ ...node, x: contextMenu.canvasX + index * 16, y: contextMenu.canvasY + index * 16 })); if (copies.length) { commit({ ...doc, nodes: [...doc.nodes, ...copies] }); setSelected(copies.map((node) => node.id)) }; setContextMenu(null) }} />
          <div className="my-1 border-t" /><MenuItem label="Zoom to fit" shortcut="Shift 1" onClick={() => { fitToContent(); setContextMenu(null) }} />
        </>}
      </div>}

      {selectedNode && canWrite && selectedNode.type !== "line" && <div className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 text-xs shadow-lg">
        {fills.map((fill) => <button key={fill} aria-label={`Set fill ${fill}`} onClick={() => updateNode(selectedNode.id, { fill })} className={cn("size-6 rounded-full border border-black/15", selectedNode.fill === fill && "ring-2 ring-primary ring-offset-2")} style={{ backgroundColor: fill }} />)}
        {(selectedNode.type === "text" || selectedNode.type === "sticky") && <><span className="mx-1 h-5 w-px bg-border" /><input aria-label="Font size" type="number" min="8" max="200" value={selectedNode.fontSize ?? (selectedNode.type === "text" ? 18 : 16)} onChange={(event) => updateNode(selectedNode.id, { fontSize: Number(event.target.value) })} className="w-14 rounded-md bg-muted px-2 py-1" /><button className={cn("rounded-md px-2 py-1 font-bold hover:bg-muted", selectedNode.fontWeight === "bold" && "bg-muted")} onClick={() => updateNode(selectedNode.id, { fontWeight: selectedNode.fontWeight === "bold" ? "normal" : "bold" })}>B</button>{(["left", "center", "right"] as const).map((align) => <button key={align} className={cn("rounded-md px-2 py-1 capitalize hover:bg-muted", (selectedNode.textAlign ?? "left") === align && "bg-muted")} onClick={() => updateNode(selectedNode.id, { textAlign: align })}>{align}</button>)}<input aria-label="Text color" type="color" value={selectedNode.textColor ?? "#1d1d1f"} onChange={(event) => updateNode(selectedNode.id, { textColor: event.target.value })} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" /></>}
      </div>}
      {selectedNode?.type === "line" && canWrite && <div className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 text-xs shadow-lg">
        <button className={cn("rounded-md px-2.5 py-1.5 hover:bg-muted", selectedNode.lineStyle !== "elbow" && "bg-muted font-medium")} onClick={() => updateNode(selectedNode.id, { lineStyle: "straight" })}>Straight</button>
        <button className={cn("rounded-md px-2.5 py-1.5 hover:bg-muted", selectedNode.lineStyle === "elbow" && "bg-muted font-medium")} onClick={() => updateNode(selectedNode.id, { lineStyle: "elbow" })}>Elbow</button>
        <span className="mx-1 h-5 w-px bg-border" />
        {(["solid", "dashed", "dotted"] as const).map((style) => <button key={style} className={cn("rounded-md px-2.5 py-1.5 capitalize hover:bg-muted", (selectedNode.strokeStyle ?? "solid") === style && "bg-muted font-medium")} onClick={() => updateNode(selectedNode.id, { strokeStyle: style })}>{style}</button>)}
        <span className="mx-1 h-5 w-px bg-border" />
        <button className={cn("rounded-md px-2.5 py-1.5 hover:bg-muted", selectedNode.endArrow !== false && "bg-muted font-medium")} onClick={() => updateNode(selectedNode.id, { endArrow: selectedNode.endArrow === false })}>Arrow</button>
      </div>}
      {canWrite && selectedNodes.length > 1 && <div className="absolute right-5 top-16 z-20 flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 text-xs shadow-lg">
        {!hasGroupedSelection && <button className="rounded-md px-3 py-1.5 hover:bg-muted" onClick={groupSelection}>Group <span className="text-muted-foreground">⌘G</span></button>}
        {hasGroupedSelection && <button className="rounded-md px-3 py-1.5 hover:bg-muted" onClick={ungroupSelection}>Ungroup <span className="text-muted-foreground">⇧⌘G</span></button>}
      </div>}
      {canWrite && selectedNodes.length > 1 && <div className={cn("absolute top-16 z-20 flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 text-xs shadow-lg", layersOpen ? "left-[260px]" : "left-5")}>
        {(["left", "center", "right", "top", "middle", "bottom"] as const).map((alignment) => <button key={alignment} title={`Align ${alignment}`} className="rounded-md px-2.5 py-1.5 capitalize hover:bg-muted" onClick={() => align(alignment)}>{alignment}</button>)}
        {selectedNodes.length > 2 && <><span className="mx-1 h-5 w-px bg-border" /><button title="Distribute horizontally" className="rounded-md px-2.5 py-1.5 hover:bg-muted" onClick={() => distribute("horizontal")}>Distribute H</button><button title="Distribute vertically" className="rounded-md px-2.5 py-1.5 hover:bg-muted" onClick={() => distribute("vertical")}>Distribute V</button></>}
      </div>}
      {canWrite && selectedNodes.length > 0 && <div className="absolute bottom-18 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-black/10 bg-white p-1.5 text-xs shadow-lg">
        {selectedNode && (["x", "y", "width", "height"] as const).map((property) => <label key={`${selectedNode.id}-${property}`} className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1"><span className="uppercase text-muted-foreground">{property === "width" ? "W" : property === "height" ? "H" : property}</span><input aria-label={property} defaultValue={Math.round(selectedNode[property])} onBlur={(event) => setNumeric(property, event.target.value)} className="w-14 bg-transparent text-right outline-none" /></label>)}
        {selectedNode && <span className="mx-1 h-5 w-px bg-border" />}
        <button className="rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => reorder("back")}>To back</button><button className="rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => reorder("backward")}>Backward</button><button className="rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => reorder("forward")}>Forward</button><button className="rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => reorder("front")}>To front</button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button className={cn("rounded-md px-2 py-1.5 hover:bg-muted", selectedNodes.every((node) => node.locked) && "bg-muted font-medium")} onClick={() => commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, locked: !selectedNodes.every((item) => item.locked) } : node) })}>{selectedNodes.every((node) => node.locked) ? "Unlock" : "Lock"}</button>
        <button className="rounded-md px-2 py-1.5 hover:bg-muted" onClick={() => commit({ ...doc, nodes: doc.nodes.map((node) => selected.includes(node.id) ? { ...node, hidden: !node.hidden } : node) })}>{selectedNodes.every((node) => node.hidden) ? "Show" : "Hide"}</button>
      </div>}

      <div role="toolbar" aria-label="Whiteboard tools" className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
        {tools.map(({ id, label, key, icon: Icon }) => <button key={id} type="button" title={`${label} (${key})`} aria-label={label} aria-pressed={tool === id || (id === "hand" && spaceDown)} disabled={!canWrite && id !== "hand" && id !== "select" && id !== "comment"} onClick={() => setTool(id)} className={cn("grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30", (tool === id || (id === "hand" && spaceDown)) && "bg-primary text-white hover:bg-primary hover:text-white")}><Icon className="size-4" /></button>)}
        <span className="mx-1 h-6 w-px bg-border" />
        <button aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!past.length || !canWrite} onClick={undo} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><Undo2Icon className="size-4" /></button>
        <button aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!future.length || !canWrite} onClick={redo} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><Redo2Icon className="size-4" /></button>
      </div>

      <div className="absolute bottom-5 right-5 z-20 flex items-center rounded-xl border border-black/10 bg-white p-1 shadow-lg">
        <button onClick={() => versions ? setVersions(null) : startTransition(async () => setVersions(await getWhiteboardVersions(boardId)))} className={cn("rounded-lg px-2 py-1.5 text-xs hover:bg-muted", versions && "bg-muted font-medium")}>History</button>
        <button aria-pressed={gridSnap} onClick={() => setGridSnap((value) => !value)} className={cn("rounded-lg px-2 py-1.5 text-xs hover:bg-muted", gridSnap && "bg-muted font-medium")}>Grid</button>
        {doc.nodes.some((node) => node.hidden) && <button aria-pressed={showHidden} onClick={() => setShowHidden((value) => !value)} className={cn("rounded-lg px-2 py-1.5 text-xs hover:bg-muted", showHidden && "bg-muted font-medium")}>Hidden</button>}
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ZoomOutIcon className="size-4" /></button>
        <button title="Fit to content (Shift 1)" onClick={fitToContent} className="min-w-14 rounded-lg px-2 py-1.5 text-xs hover:bg-muted">{Math.round(camera.zoom * 100)}%</button>
        <button title="Zoom to selection (Shift 2)" disabled={!selected.length} onClick={zoomToSelection} className="rounded-lg px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-30">Selection</button>
        <button aria-label="Zoom in" onClick={() => zoomBy(1.2)} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ZoomInIcon className="size-4" /></button>
        <button aria-label="Reset view" onClick={() => setCamera({ x: -300, y: -180, zoom: 1 })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><RotateCcwIcon className="size-4" /></button>
      </div>
      {versions && <aside className="absolute bottom-16 right-5 top-28 z-30 w-72 overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-heading font-semibold">Version history</h2><button className="text-xs text-muted-foreground" onClick={() => setVersions(null)}>Close</button></div><div className="space-y-1">{versions.map((version) => <button key={version.revision} className="block w-full rounded-lg p-2 text-left hover:bg-muted" onClick={() => { suppressSaveRef.current = false; setDoc(version.document as BoardDocument); setVersions(null); setSaveState("saving") }}><span className="block text-sm font-medium">Version {version.revision}</span><span className="text-xs text-muted-foreground">{version.author} · {new Date(version.createdAt).toLocaleString()}</span></button>)}</div></aside>}
      {commentsOpen && <aside className="absolute bottom-16 right-5 top-28 z-30 w-80 overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-heading font-semibold">Comments</h2><button className="text-xs text-muted-foreground" onClick={() => { setCommentsOpen(false); setCommentDraft(null) }}>Close</button></div>{commentDraft && <form className="mb-3 space-y-2" action={(formData) => startTransition(async () => { const result = await addWhiteboardComment(boardId, { body: String(formData.get("body") ?? ""), ...commentDraft }); if (result.ok) { setComments((current) => current.some((comment) => comment.id === result.comment.id) ? current : [...current, result.comment]); setCommentDraft(null) } })}><textarea name="body" autoFocus placeholder="Comment… Mention someone with @Full Name" className="min-h-24 w-full resize-none rounded-lg border p-2 text-sm outline-none focus:ring-2 focus:ring-primary" /><button className="rounded-md bg-primary px-3 py-1.5 text-sm text-white">Post</button></form>}<div className="space-y-2">{comments.map((comment, index) => <article key={comment.id} className="rounded-lg border p-2 text-sm"><p className="font-medium">{index + 1}. {comment.author}</p><p className="mt-1 whitespace-pre-wrap">{comment.body}</p><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{new Date(comment.createdAt).toLocaleString()}</span>{canWrite && <button onClick={() => startTransition(async () => { await resolveWhiteboardComment(boardId, comment.id); setComments((current) => current.filter((item) => item.id !== comment.id)) })}>Resolve</button>}</div></article>)}</div></aside>}
      {shareOpen && <aside className="absolute bottom-16 right-5 top-28 z-30 w-80 overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-xl"><div className="mb-3 flex items-center justify-between"><h2 className="font-heading font-semibold">Share board</h2><button className="text-xs text-muted-foreground" onClick={() => setShareOpen(false)}>Close</button></div><div className="space-y-2">{team.map((person) => { const member = members.find((item) => item.userId === person.id); return <div key={person.id} className="flex items-center justify-between gap-2 rounded-lg border p-2"><span className="truncate text-sm">{person.name}</span><select value={member?.access ?? "NONE"} onChange={(event) => setMembers((current) => event.target.value === "NONE" ? current.filter((item) => item.userId !== person.id) : [...current.filter((item) => item.userId !== person.id), { userId: person.id, access: event.target.value as "READ" | "WRITE" }])} className="rounded-md border bg-white px-2 py-1 text-xs"><option value="NONE">No access</option><option value="READ">Can view</option><option value="WRITE">Can edit</option></select></div>})}</div><button className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm text-white" onClick={() => startTransition(async () => { const result = await updateWhiteboardSharing(boardId, members); if (result.ok) setShareOpen(false) })}>Save sharing</button></aside>}
      {contentBounds && <svg aria-label="Board minimap" className="absolute bottom-5 left-5 z-20 h-24 w-40 rounded-xl border border-black/10 bg-white/95 p-2 shadow-lg" viewBox={`${contentBounds.x - 40} ${contentBounds.y - 40} ${Math.max(200, contentBounds.width + 80)} ${Math.max(120, contentBounds.height + 80)}`}>
        {renderNodes.filter((node) => !node.hidden).map((node) => { const box = nodeBox(node); return <rect key={node.id} x={box.x} y={box.y} width={Math.max(2, box.width)} height={Math.max(2, box.height)} rx="2" fill={node.type === "line" ? node.stroke : node.fill} stroke="#777" strokeWidth="1" /> })}
        <rect x={camera.x} y={camera.y} width={viewport.width / camera.zoom} height={viewport.height / camera.zoom} fill="#2563eb12" stroke="#2563eb" strokeWidth="2" />
      </svg>}
    </div>
  )
}
