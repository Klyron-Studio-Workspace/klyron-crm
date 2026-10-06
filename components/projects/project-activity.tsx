import { formatDateTime, formatRelative } from "@/lib/format"
import type { ProjectEventDTO } from "@/lib/projects/types"

function describe(action: string, m: Record<string, unknown> | null) {
  const s = (key: string) => (typeof m?.[key] === "string" ? (m[key] as string) : "")
  switch (action) {
    case "project.create":
      return "created the project"
    case "project.status":
      return `changed status from ${s("from")} to ${s("to")}`
    case "project.update": {
      const fields = Array.isArray(m?.fields) ? (m.fields as string[]) : []
      const labels: Record<string, string> = { ownerId: "lead", clientId: "client", serviceId: "service", dueDate: "deadline", startDate: "start date", description: "brief" }
      return fields.length ? `updated ${fields.map((f) => labels[f] ?? f).join(", ")}` : "updated the project"
    }
    case "task.create":
      return `added “${s("title")}”`
    case "task.status":
      return `moved “${s("title")}” to ${s("to")}`
    case "task.assign":
      return `assigned “${s("title")}” to ${s("to")}`
    case "task.delete":
      return `deleted “${s("title")}”`
    case "milestone.create":
      return `added milestone “${s("name")}”`
    case "milestone.complete":
      return `reached milestone “${s("name")}”`
    case "milestone.delete":
      return `removed milestone “${s("name")}”`
    default:
      return action
  }
}

function ProjectActivity({ events }: { events: ProjectEventDTO[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{e.actorName ?? "Someone"}</span> {describe(e.action, e.metadata)}{" "}
          <time suppressHydrationWarning dateTime={e.at} title={formatDateTime(new Date(e.at))} className="text-xs">
            · {formatRelative(new Date(e.at))}
          </time>
        </li>
      ))}
    </ol>
  )
}

export { ProjectActivity }
