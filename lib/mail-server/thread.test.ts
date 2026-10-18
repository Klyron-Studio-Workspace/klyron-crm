import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeSubject } from "./thread.ts"

test("normalizeSubject strips Re:", () => {
  assert.equal(normalizeSubject("Re: Meeting tomorrow"), "Meeting tomorrow")
})

test("normalizeSubject strips Fwd:", () => {
  assert.equal(normalizeSubject("Fwd: Invoice #123"), "Invoice #123")
})

test("normalizeSubject strips nested prefixes", () => {
  assert.equal(normalizeSubject("Re: Re: Fwd: Hello"), "Hello")
})

test("normalizeSubject trims whitespace", () => {
  assert.equal(normalizeSubject("  Hello world  "), "Hello world")
})
