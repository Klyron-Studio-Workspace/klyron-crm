import type { BoardNode } from "./document"

export type Box = { x: number; y: number; width: number; height: number }
export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"
export type ConnectionSide = "top" | "right" | "bottom" | "left"
export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom"
export type Distribution = "horizontal" | "vertical"
export type SnapResult = { x: number; y: number; guideX?: number; guideY?: number }
export type DistanceMeasure = { axis: "x" | "y"; from: number; to: number; cross: number; distance: number }

export function nodeBox(node: BoardNode): Box {
  const base = { x: Math.min(node.x, node.x + node.width), y: Math.min(node.y, node.y + node.height), width: Math.abs(node.width), height: Math.abs(node.height) }
  if (!node.rotation) return base
  const center = { x: base.x + base.width / 2, y: base.y + base.height / 2 }
  const corners = [[base.x, base.y], [base.x + base.width, base.y], [base.x + base.width, base.y + base.height], [base.x, base.y + base.height]].map(([x, y]) => rotatePoint({ x, y }, center, node.rotation!))
  const left = Math.min(...corners.map((point) => point.x)); const top = Math.min(...corners.map((point) => point.y))
  const right = Math.max(...corners.map((point) => point.x)); const bottom = Math.max(...corners.map((point) => point.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, degrees: number) {
  const angle = degrees * Math.PI / 180; const cosine = Math.cos(angle); const sine = Math.sin(angle)
  const x = point.x - center.x; const y = point.y - center.y
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine }
}

export function selectionBox(nodes: BoardNode[]): Box | null {
  if (!nodes.length) return null
  const boxes = nodes.map(nodeBox)
  const x = Math.min(...boxes.map((box) => box.x)); const y = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width)); const bottom = Math.max(...boxes.map((box) => box.y + box.height))
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

export function dragBox(x1: number, y1: number, x2: number, y2: number): Box {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

export function resizeBox(box: Box, handle: ResizeHandle, x: number, y: number, preserveRatio: boolean, fromCenter: boolean): Box {
  const centerX = box.x + box.width / 2; const centerY = box.y + box.height / 2
  let left = box.x; let right = box.x + box.width; let top = box.y; let bottom = box.y + box.height
  if (handle.includes("w")) { left = x; if (fromCenter) right = centerX + (centerX - x) }
  if (handle.includes("e")) { right = x; if (fromCenter) left = centerX - (x - centerX) }
  if (handle.includes("n")) { top = y; if (fromCenter) bottom = centerY + (centerY - y) }
  if (handle.includes("s")) { bottom = y; if (fromCenter) top = centerY - (y - centerY) }
  let next = dragBox(left, top, right, bottom)
  if (!preserveRatio || next.width < 1 || next.height < 1) return next
  const ratio = box.width / box.height
  let width = next.width; let height = next.height
  if (handle === "e" || handle === "w") height = width / ratio
  else if (handle === "n" || handle === "s") width = height * ratio
  else if (width / height > ratio) height = width / ratio
  else width = height * ratio
  const anchorX = fromCenter || handle === "n" || handle === "s" ? centerX : handle.includes("w") ? box.x + box.width : box.x
  const anchorY = fromCenter || handle === "e" || handle === "w" ? centerY : handle.includes("n") ? box.y + box.height : box.y
  next = {
    x: fromCenter || handle === "n" || handle === "s" ? anchorX - width / 2 : handle.includes("w") ? anchorX - width : anchorX,
    y: fromCenter || handle === "e" || handle === "w" ? anchorY - height / 2 : handle.includes("n") ? anchorY - height : anchorY,
    width, height,
  }
  return next
}

export function connectionPoint(node: BoardNode, side: ConnectionSide) {
  const box = { x: Math.min(node.x, node.x + node.width), y: Math.min(node.y, node.y + node.height), width: Math.abs(node.width), height: Math.abs(node.height) }
  const point = side === "top" ? { x: box.x + box.width / 2, y: box.y } : side === "right" ? { x: box.x + box.width, y: box.y + box.height / 2 } : side === "bottom" ? { x: box.x + box.width / 2, y: box.y + box.height } : { x: box.x, y: box.y + box.height / 2 }
  return node.rotation ? rotatePoint(point, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, node.rotation) : point
}

export function connectorPoints(connector: BoardNode, nodes: BoardNode[]) {
  const startNode = connector.startId ? nodes.find((node) => node.id === connector.startId) : undefined
  const endNode = connector.endId ? nodes.find((node) => node.id === connector.endId) : undefined
  const start = startNode && connector.startSide ? connectionPoint(startNode, connector.startSide) : { x: connector.x, y: connector.y }
  const end = endNode && connector.endSide ? connectionPoint(endNode, connector.endSide) : { x: connector.x + connector.width, y: connector.y + connector.height }
  return { start, end }
}

export function expandGroupedSelection(ids: string[], nodes: BoardNode[]) {
  const groups = new Set(nodes.filter((node) => ids.includes(node.id) && node.groupId).map((node) => node.groupId))
  return [...new Set([...ids, ...nodes.filter((node) => node.groupId && groups.has(node.groupId)).map((node) => node.id)])]
}

export function alignSelection(nodes: BoardNode[], selectedIds: string[], alignment: Alignment) {
  const selected = nodes.filter((node) => selectedIds.includes(node.id))
  const overall = selectionBox(selected)
  if (!overall || selected.length < 2) return nodes
  const entities = new Map<string, BoardNode[]>()
  for (const node of selected) {
    const key = node.groupId ? `group:${node.groupId}` : `node:${node.id}`
    entities.set(key, [...(entities.get(key) ?? []), node])
  }
  const movement = new Map<string, { x: number; y: number }>()
  for (const entity of entities.values()) {
    const box = selectionBox(entity)!
    let x = 0; let y = 0
    if (alignment === "left") x = overall.x - box.x
    if (alignment === "center") x = overall.x + overall.width / 2 - (box.x + box.width / 2)
    if (alignment === "right") x = overall.x + overall.width - (box.x + box.width)
    if (alignment === "top") y = overall.y - box.y
    if (alignment === "middle") y = overall.y + overall.height / 2 - (box.y + box.height / 2)
    if (alignment === "bottom") y = overall.y + overall.height - (box.y + box.height)
    for (const node of entity) movement.set(node.id, { x, y })
  }
  return nodes.map((node) => { const move = movement.get(node.id); return move ? { ...node, x: node.x + move.x, y: node.y + move.y } : node })
}

export function distributeSelection(nodes: BoardNode[], selectedIds: string[], distribution: Distribution) {
  const selected = nodes.filter((node) => selectedIds.includes(node.id))
  const entities = new Map<string, BoardNode[]>()
  for (const node of selected) {
    const key = node.groupId ? `group:${node.groupId}` : `node:${node.id}`
    entities.set(key, [...(entities.get(key) ?? []), node])
  }
  const ordered = [...entities.values()].map((members) => ({ members, box: selectionBox(members)! })).sort((a, b) => distribution === "horizontal" ? a.box.x - b.box.x : a.box.y - b.box.y)
  if (ordered.length < 3) return nodes
  const first = ordered[0].box; const last = ordered.at(-1)!.box
  const totalSize = ordered.reduce((sum, item) => sum + (distribution === "horizontal" ? item.box.width : item.box.height), 0)
  const span = distribution === "horizontal" ? last.x + last.width - first.x : last.y + last.height - first.y
  const gap = (span - totalSize) / (ordered.length - 1)
  const movement = new Map<string, { x: number; y: number }>()
  let cursor = distribution === "horizontal" ? first.x : first.y
  for (const item of ordered) {
    const delta = cursor - (distribution === "horizontal" ? item.box.x : item.box.y)
    for (const node of item.members) movement.set(node.id, distribution === "horizontal" ? { x: delta, y: 0 } : { x: 0, y: delta })
    cursor += (distribution === "horizontal" ? item.box.width : item.box.height) + gap
  }
  return nodes.map((node) => { const move = movement.get(node.id); return move ? { ...node, x: node.x + move.x, y: node.y + move.y } : node })
}

export function snapTranslation(moving: Box, others: Box[], x: number, y: number, threshold: number): SnapResult {
  const movedX = [moving.x + x, moving.x + moving.width / 2 + x, moving.x + moving.width + x]
  const movedY = [moving.y + y, moving.y + moving.height / 2 + y, moving.y + moving.height + y]
  const targetsX = others.flatMap((box) => [box.x, box.x + box.width / 2, box.x + box.width])
  const targetsY = others.flatMap((box) => [box.y, box.y + box.height / 2, box.y + box.height])
  let bestX: { delta: number; guide: number } | undefined; let bestY: { delta: number; guide: number } | undefined
  for (const source of movedX) for (const target of targetsX) { const delta = target - source; if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, guide: target } }
  for (const source of movedY) for (const target of targetsY) { const delta = target - source; if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, guide: target } }
  return { x: x + (bestX?.delta ?? 0), y: y + (bestY?.delta ?? 0), guideX: bestX?.guide, guideY: bestY?.guide }
}

export function nearestDistances(selected: Box, others: Box[]): DistanceMeasure[] {
  const measures: DistanceMeasure[] = []
  const verticalOverlap = (box: Box) => box.y <= selected.y + selected.height && box.y + box.height >= selected.y
  const horizontalOverlap = (box: Box) => box.x <= selected.x + selected.width && box.x + box.width >= selected.x
  const left = others.filter((box) => verticalOverlap(box) && box.x + box.width <= selected.x).sort((a, b) => b.x + b.width - (a.x + a.width))[0]
  const right = others.filter((box) => verticalOverlap(box) && box.x >= selected.x + selected.width).sort((a, b) => a.x - b.x)[0]
  const top = others.filter((box) => horizontalOverlap(box) && box.y + box.height <= selected.y).sort((a, b) => b.y + b.height - (a.y + a.height))[0]
  const bottom = others.filter((box) => horizontalOverlap(box) && box.y >= selected.y + selected.height).sort((a, b) => a.y - b.y)[0]
  if (left) measures.push({ axis: "x", from: left.x + left.width, to: selected.x, cross: selected.y + selected.height / 2, distance: selected.x - left.x - left.width })
  if (right) measures.push({ axis: "x", from: selected.x + selected.width, to: right.x, cross: selected.y + selected.height / 2, distance: right.x - selected.x - selected.width })
  if (top) measures.push({ axis: "y", from: top.y + top.height, to: selected.y, cross: selected.x + selected.width / 2, distance: selected.y - top.y - top.height })
  if (bottom) measures.push({ axis: "y", from: selected.y + selected.height, to: bottom.y, cross: selected.x + selected.width / 2, distance: bottom.y - selected.y - selected.height })
  return measures
}
