import assert from "node:assert/strict"
import test from "node:test"

import { parseLeadInsights } from "./ai-result.ts"

test("parses a bounded lead analysis", () => {
  assert.deepEqual(
    parseLeadInsights('{"score":72,"rationale":["Asked for pricing"],"next_step":"Send scope","follow_up":"Hello"}'),
    { score: 72, rationale: ["Asked for pricing"], nextStep: "Send scope", followUp: "Hello" }
  )
  assert.throws(() => parseLeadInsights('{"score":101,"rationale":[],"next_step":"","follow_up":""}'))
})

test("trims verbose model text instead of rejecting the whole result", () => {
  const result = parseLeadInsights(JSON.stringify({
    score: 50,
    rationale: ["x".repeat(301)],
    next_step: "y".repeat(501),
    follow_up: "z".repeat(3001),
  }))
  assert.equal(result.rationale[0].length, 300)
  assert.equal(result.nextStep.length, 500)
  assert.equal(result.followUp.length, 3000)
})
