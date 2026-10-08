import {
  BuildingIcon,
  LandmarkIcon,
  FolderKanbanIcon,
  FolderOpenIcon,
  MessagesSquareIcon,
  VideoIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  PanelsTopLeftIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type { ModuleKey } from "@/lib/auth/permissions"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Hidden unless the user can read this module. */
  module?: ModuleKey
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
      { title: "Leads", href: "/leads", icon: KanbanSquareIcon, module: "leads" },
      { title: "Clients", href: "/clients", icon: BuildingIcon, module: "clients" },
      { title: "Projects", href: "/projects", icon: FolderKanbanIcon, module: "projects" },
      { title: "Finance", href: "/finance", icon: LandmarkIcon, module: "finance" },
      { title: "Chat", href: "/chat", icon: MessagesSquareIcon, module: "chat" },
      { title: "Calls", href: "/calls", icon: VideoIcon, module: "chat" },
      { title: "Files", href: "/files", icon: FolderOpenIcon, module: "files" },
      { title: "Whiteboard", href: "/whiteboard", icon: PanelsTopLeftIcon, module: "whiteboard" },
      { title: "Team", href: "/team", icon: UsersIcon, module: "team" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings", href: "/settings", icon: SettingsIcon },
      { title: "UI kit", href: "/ui-kit", icon: PaletteIcon },
    ],
  },
]

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function findNavItem(pathname: string) {
  return navSections
    .flatMap((section) => section.items)
    .find((item) => isNavItemActive(pathname, item.href))
}
