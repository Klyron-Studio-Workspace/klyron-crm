// Client-safe constants for projects and tasks.

export const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const
export type ProjectStatusKey = (typeof projectStatuses)[number]

export const projectStatusLabels: Record<ProjectStatusKey, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

/** Badge variants (soft tints). */
export const projectStatusTone = {
  PLANNING: "info",
  ACTIVE: "brand",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
} as const satisfies Record<ProjectStatusKey, string>

export const openProjectStatuses: ProjectStatusKey[] = ["PLANNING", "ACTIVE", "ON_HOLD"]

export const taskStatuses = ["TODO", "DOING", "DONE"] as const
export type TaskStatusKey = (typeof taskStatuses)[number]

export const taskStatusLabels: Record<TaskStatusKey, string> = {
  TODO: "To do",
  DOING: "Doing",
  DONE: "Done",
}

export const taskPriorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const
export type TaskPriorityKey = (typeof taskPriorities)[number]

export const taskPriorityLabels: Record<TaskPriorityKey, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
}

export const taskPriorityTone = {
  URGENT: "brand",
  HIGH: "warning",
  MEDIUM: "neutral",
  LOW: "neutral",
} as const satisfies Record<TaskPriorityKey, string>
