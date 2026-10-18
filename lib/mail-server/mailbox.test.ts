import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeAddress } from "./mailbox.ts"

test("normalizeAddress lowercases and trims", () => {
  assert.equal(normalizeAddress("  Ali@KlyronStudio.COM  "), "ali@klyronstudio.com")
})

test("normalizeAddress strips display name", () => {
  assert.equal(normalizeAddress("Ali Syed <ali@klyronstudio.com>"), "ali@klyronstudio.com")
})
