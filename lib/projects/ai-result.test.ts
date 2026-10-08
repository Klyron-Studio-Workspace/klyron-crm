import assert from "node:assert/strict"
import test from "node:test"

import { parseProjectInsights } from "./ai-result.ts"

test("parses and bounds project insights", () => {
  const result = parseProjectInsights(JSON.stringify({
    status_summary: "x".repeat(3001),
    health: "AT_RISK",
    risks: [{ risk: "Late task", action: "Reassign it" }],
  }))
  assert.equal(result.summary.length, 3000)
  assert.equal(result.health, "AT_RISK")
  assert.deepEqual(result.risks[0], { risk: "Late task", action: "Reassign it" })
  assert.throws(() => parseProjectInsights('{"status_summary":"ok","health":"MAYBE","risks":[]}'))
})
