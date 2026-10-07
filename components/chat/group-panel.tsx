"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, Trash2Icon, UserMinusIcon, UserPlusIcon, UsersIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/toast"
import { addGroupMembers, deleteGroup, getGroupMembers, removeGroupMember, renameGroup } from "@/lib/actions/chat"
import { initials } from "@/lib/format"
import type { PersonDTO } from "@/lib/leads/types"

type Members = NonNullable<Awaited<ReturnType<typeof getGroupMembers>>>

type GroupPanelProps = {
  channelId: string
  name: string
  memberCount: number
  currentUserId: string
  /** Every active teammate, for adding people. */
  teammates: PersonDTO[]
}

function GroupPanel({ channelId, name, memberCount, currentUserId, teammates }: GroupPanelProps) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState<Members | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [rename, setRename] = React.useState(name)
  const [adding, setAdding] = React.useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const load = React.useCallback(() => {
    void getGroupMembers(channelId).then(setData)
  }, [channelId])

  function run(task: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    startTransition(async () => {
      const result = await task()
      if (!result.ok) {
        toast.add({ type: "error", title: "Couldn't update the group", description: result.error })
        return
      }
      done?.()
      load()
      router.refresh()
    })
  }

  const memberIds = new Set(data?.members.map((m) => m.id))
  const addable = teammates.filter((t) => !memberIds.has(t.id) && t.id !== currentUserId)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true)
          setRename(name)
          setAdding([])
          setConfirmDelete(false)
          load()
        }}
      >
        <UsersIcon data-icon="inline-start" />
        {memberCount}
        <span className="sr-only"> members, manage group</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md!">
          <SheetHeader>
            <SheetTitle>{name}</SheetTitle>
            <SheetDescription>Private group. Only members can see its messages, files and calls.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-6">
            {data?.canManage && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => renameGroup(channelId, rename))
                }}
              >
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="group-rename">Name</Label>
                  <Input id="group-rename" value={rename} maxLength={60} onChange={(e) => setRename(e.target.value)} />
                </div>
                <Button type="submit" variant="secondary" disabled={pending || !rename.trim() || rename.trim() === name}>
                  Rename
                </Button>
              </form>
            )}

            <section aria-labelledby="group-members" className="flex flex-col gap-2">
              <h3 id="group-members" className="text-sm font-medium">
                Members{data ? ` (${data.members.length})` : ""}
              </h3>
              {!data ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {data.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {m.name}
                          {m.id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                        </p>
                        {m.title && <p className="truncate text-xs text-muted-foreground">{m.title}</p>}
                      </div>
                      {m.id === data.createdById && <Badge variant="neutral" className="rounded-md">Creator</Badge>}
                      {data.canManage && m.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${m.name}`}
                          disabled={pending}
                          className="text-muted-foreground hover:text-primary-strong"
                          onClick={() => run(() => removeGroupMember(channelId, m.id))}
                        >
                          <UserMinusIcon />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data?.canManage && (
              <section aria-labelledby="group-add" className="flex flex-col gap-2">
                <h3 id="group-add" className="text-sm font-medium">Add people</h3>
                {addable.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Everyone on the team is already here.</p>
                ) : (
                  <>
                    <fieldset className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
                      <legend className="sr-only">Teammates not in the group</legend>
                      {addable.map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={adding.includes(t.id)}
                            onChange={(e) => setAdding((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))}
                            className="size-4 accent-primary"
                          />
                          {t.name}
                        </label>
                      ))}
                    </fieldset>
                    <Button
                      variant="secondary"
                      className="w-fit"
                      disabled={pending || adding.length === 0}
                      onClick={() => run(() => addGroupMembers(channelId, adding), () => setAdding([]))}
                    >
                      <UserPlusIcon data-icon="inline-start" />
                      Add {adding.length > 0 ? adding.length : ""}
                    </Button>
                  </>
                )}
              </section>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run(
                    () => removeGroupMember(channelId, currentUserId),
                    () => {
                      setOpen(false)
                      router.push("/chat")
                    }
                  )
                }
              >
                <LogOutIcon data-icon="inline-start" />
                Leave group
              </Button>
              {data?.canManage &&
                (confirmDelete ? (
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => deleteGroup(channelId),
                        () => {
                          setOpen(false)
                          router.push("/chat")
                        }
                      )
                    }
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Yes, delete group and its messages
                  </Button>
                ) : (
                  <Button variant="ghost" className="text-primary-strong" onClick={() => setConfirmDelete(true)}>
                    <Trash2Icon data-icon="inline-start" />
                    Delete group
                  </Button>
                ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export { GroupPanel }
