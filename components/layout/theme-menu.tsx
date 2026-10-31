"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { setTheme, useTheme, type Theme } from "@/lib/theme"

export const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const satisfies { value: Theme; label: string; icon: unknown }[]

/** Light / Dark / System picker for account dropdowns. */
function ThemeMenuGroup() {
  const theme = useTheme()
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            <Icon /> {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}

export { ThemeMenuGroup }
