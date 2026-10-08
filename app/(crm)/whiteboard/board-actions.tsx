"use client"

import { CopyIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useTransition } from "react"

import { deleteWhiteboard, duplicateWhiteboard, toggleWhiteboardFavorite } from "@/lib/actions/whiteboards"
import { cn } from "@/lib/utils"

export function BoardActions({ id, favorite, canManage }: { id: string; favorite: boolean; canManage: boolean }) {
  const [pending, startTransition] = useTransition()
  return <div className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-lg border bg-white/95 p-1 shadow-sm" onClick={(event) => event.preventDefault()}>
    <button disabled={pending} title={favorite ? "Remove favorite" : "Favorite"} className="rounded p-1.5 hover:bg-muted" onClick={() => startTransition(() => toggleWhiteboardFavorite(id))}><StarIcon className={cn("size-4", favorite && "fill-amber-400 text-amber-500")} /></button>
    <button disabled={pending} title="Duplicate" className="rounded p-1.5 hover:bg-muted" onClick={() => startTransition(() => duplicateWhiteboard(id))}><CopyIcon className="size-4" /></button>
    {canManage && <button disabled={pending} title="Delete" className="rounded p-1.5 text-destructive hover:bg-muted" onClick={() => { if (confirm("Delete this board? This cannot be undone.")) startTransition(() => deleteWhiteboard(id)) }}><Trash2Icon className="size-4" /></button>}
  </div>
}
