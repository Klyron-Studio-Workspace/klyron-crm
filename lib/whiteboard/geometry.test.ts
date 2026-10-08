import assert from "node:assert/strict"
import test from "node:test"

import type { BoardNode } from "./document.ts"
import { alignSelection, connectorPoints, distributeSelection, dragBox, expandGroupedSelection, nearestDistances, resizeBox, selectionBox, snapTranslation } from "./geometry.ts"

const node = (x: number, y: number, width: number, height: number): BoardNode => ({ id: crypto.randomUUID(), type: "rectangle", x, y, width, height, text: "", fill: "#ffffff", stroke: "#000000" })

test("normalizes reverse drawing and bounds multiple selected nodes", () => {
  assert.deepEqual(dragBox(100, 80, 20, 30), { x: 20, y: 30, width: 80, height: 50 })
  assert.deepEqual(selectionBox([node(10, 20, 30, 40), node(100, 10, -20, 15)]), { x: 10, y: 10, width: 90, height: 50 })
})

test("attached connector endpoints follow their shapes", () => {
  const left = node(10, 20, 100, 60); const right = node(300, 40, 80, 100)
  const connector: BoardNode = { ...node(0, 0, 1, 1), type: "line", startId: left.id, startSide: "right", endId: right.id, endSide: "left" }
  assert.deepEqual(connectorPoints(connector, [left, right, connector]), { start: { x: 110, y: 50 }, end: { x: 300, y: 90 } })
})

test("rotated nodes use their visual bounds", () => {
  const rotated = { ...node(0, 0, 100, 50), rotation: 90 }
  assert.deepEqual(selectionBox([rotated]), { x: 25, y: -25, width: 50, height: 100 })
})

test("expands a selection to every member of its group", () => {
  const one = { ...node(0, 0, 10, 10), groupId: "group" }; const two = { ...node(20, 0, 10, 10), groupId: "group" }; const other = node(40, 0, 10, 10)
  assert.deepEqual(new Set(expandGroupedSelection([one.id], [one, two, other])), new Set([one.id, two.id]))
})

test("aligns grouped objects as one unit", () => {
  const one = { ...node(10, 10, 10, 10), groupId: "group" }; const two = { ...node(30, 10, 10, 10), groupId: "group" }; const anchor = node(100, 20, 20, 20)
  const aligned = alignSelection([one, two, anchor], [one.id, two.id, anchor.id], "right")
  assert.deepEqual(aligned.slice(0, 2).map((item) => item.x), [90, 110])
})

test("distributes objects with equal visual gaps", () => {
  const left = node(0, 0, 20, 20); const middle = node(30, 0, 40, 20); const right = node(160, 0, 20, 20)
  const distributed = distributeSelection([left, middle, right], [left.id, middle.id, right.id], "horizontal")
  assert.equal(distributed[1].x, 70)
})

test("snaps moving bounds to nearby edges and centers", () => {
  assert.deepEqual(snapTranslation({ x: 10, y: 10, width: 20, height: 20 }, [{ x: 50, y: 40, width: 20, height: 20 }], 17, 9, 4), { x: 20, y: 10, guideX: 50, guideY: 40 })
})

test("measures gaps to nearest aligned neighbors", () => {
  const measures = nearestDistances({ x: 50, y: 20, width: 20, height: 20 }, [{ x: 10, y: 20, width: 20, height: 20 }, { x: 100, y: 20, width: 10, height: 20 }])
  assert.deepEqual(measures.map((measure) => measure.distance), [20, 30])
})

test("resizes from sides, preserves ratio, and supports center resizing", () => {
  const box = { x: 10, y: 20, width: 200, height: 100 }
  assert.deepEqual(resizeBox(box, "e", 310, 0, false, false), { x: 10, y: 20, width: 300, height: 100 })
  assert.deepEqual(resizeBox(box, "se", 310, 120, true, false), { x: 10, y: 20, width: 300, height: 150 })
  assert.deepEqual(resizeBox(box, "e", 310, 0, false, true), { x: -90, y: 20, width: 400, height: 100 })
})
