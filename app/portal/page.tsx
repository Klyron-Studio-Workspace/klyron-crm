import type { Metadata } from "next"
import { FolderKanbanIcon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { ProjectCard } from "@/components/projects/project-card"
import { requireClientUser } from "@/lib/auth/dal"
import { db } from "@/lib/db"
import { getPortalProjects } from "@/lib/projects/queries"

export const metadata: Metadata = { title: "Client portal" }

export default async function PortalHomePage() {
  const user = await requireClientUser()
  const [client, projects] = await Promise.all([
    db.client.findUnique({ where: { id: user.clientId }, select: { name: true } }),
    getPortalProjects(user.clientId),
  ])
  const firstName = user.name.split(" ")[0]

  return (
    <>
      <PageHeader
        editorial
        title={`Welcome, ${firstName}.`}
        description={`${client?.name ?? "Your"} projects with Klyron Studio.`}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title="Your projects will live here."
          description="Progress, milestones and deadlines appear here as soon as your project starts."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} href={`/portal/projects/${project.id}`} showClient={false} clientView />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
