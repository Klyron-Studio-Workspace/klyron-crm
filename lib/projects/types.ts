// Client-safe shapes passed from server components to client components.
import type { PersonDTO } from "@/lib/leads/types"

import type { ProjectStatusKey, TaskPriorityKey, TaskStatusKey } from "./constants"

export type Progress = { done: number; total: number; percent: number }

export type ProjectSummaryDTO = {
  id: string
  name: string
  status: ProjectStatusKey
  client: { id: string; name: string }
  service: string | null
  owner: PersonDTO | null
  startDate: string | null
  dueDate: string | null
  progress: Progress
  openTasks: number
  overdueTasks: number
  nextMilestone: { name: string; dueDate: string | null } | null
  updatedAt: string
}

export type MilestoneDTO = {
  id: string
  name: string
  dueDate: string | null
  completedAt: string | null
  progress: Progress
}

export type TaskDTO = {
  id: string
  title: string
  description: string | null
  status: TaskStatusKey
  priority: TaskPriorityKey
  assignee: PersonDTO | null
  milestoneId: string | null
  dueDate: string | null
  position: number
  completedAt: string | null
}

export type ProjectEventDTO = {
  id: string
  action: string
  actorName: string | null
  metadata: Record<string, unknown> | null
  at: string
}

export type ProjectDetailDTO = {
  id: string
  name: string
  description: string | null
  status: ProjectStatusKey
  client: { id: string; name: string }
  serviceId: string | null
  serviceName: string | null
  owner: PersonDTO | null
  members: PersonDTO[]
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  progress: Progress
  milestones: MilestoneDTO[]
  tasks: TaskDTO[]
  activity: ProjectEventDTO[]
}
