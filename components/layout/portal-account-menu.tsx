"use client"

import Link from "next/link"
import { KeyRoundIcon, LogOutIcon } from "lucide-react"

import { ThemeMenuGroup } from "@/components/layout/theme-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/lib/actions/auth"
import { initials } from "@/lib/format"

function PortalAccountMenu({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-foreground text-[11px] font-medium text-background">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            <span className="block truncate font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeMenuGroup />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/change-password" />}>
          <KeyRoundIcon /> Change password
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { PortalAccountMenu }
