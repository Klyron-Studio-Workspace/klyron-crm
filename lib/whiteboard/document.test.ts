import assert from "node:assert/strict"
import test from "node:test"

import { emptyBoard, parseBoardDocument } from "./document.ts"

test("invalid or oversized whiteboard documents are discarded safely", () => {
  assert.deepEqual(parseBoardDocument({ version: 2, nodes: [] }), emptyBoard)
  assert.deepEqual(parseBoardDocument({ version: 1, nodes: [{ id: "bad" }] }), emptyBoard)
})
