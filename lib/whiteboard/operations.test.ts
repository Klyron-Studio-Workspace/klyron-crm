import assert from "node:assert/strict"
import test from "node:test"

import { applyWhiteboardOperations } from "./operations.ts"

test("applies semantic whiteboard operations without exposing document JSON", () => {
  const added = applyWhiteboardOperations({ version: 1, nodes: [] }, [{ op: "add", clientId: "hero", type: "rectangle", x: 20, y: 30, width: 300 }])
  const nodeId = added.created.hero
  assert.equal(added.document.nodes[0].width, 300)
  const updated = applyWhiteboardOperations(added.document, [{ op: "update", nodeId, fill: "#ff0000" }])
  assert.equal(updated.document.nodes[0].fill, "#ff0000")
  assert.equal(applyWhiteboardOperations(updated.document, [{ op: "delete", nodeId }]).document.nodes.length, 0)
})
