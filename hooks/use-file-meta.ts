"use client"

import * as React from "react"

import type { FileDTO } from "@/lib/files/types"

// Shared across the page: each tagged file's details are fetched once.
const cache = new Map<string, Promise<FileDTO | null>>()

function load(id: string) {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`/api/files/${encodeURIComponent(id)}?meta=1`)
      .then((r) => (r.ok ? (r.json() as Promise<FileDTO>) : null))
      .catch(() => null)
    cache.set(id, p)
  }
  return p
}

/** Details for files tagged in a message. Missing or inaccessible files resolve to null. */
export function useFileMeta(ids: string[]) {
  const key = ids.join(",")
  const [files, setFiles] = React.useState<Record<string, FileDTO | null>>({})
  React.useEffect(() => {
    if (!key) return
    let cancelled = false
    void Promise.all(key.split(",").map(async (id) => [id, await load(id)] as const)).then((pairs) => {
      if (!cancelled) setFiles(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [key])
  return files
}
