"use client"

import { useSyncExternalStore } from "react"

import { DARK_QUERY, THEME_KEY as KEY } from "@/lib/theme-script"

export type Theme = "light" | "dark" | "system"

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === "dark" || t === "system" ? t : "light"
  } catch {
    return "light"
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle("dark", dark)
}

const listeners = new Set<() => void>()

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {}
  applyTheme(theme)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Follow the OS while on "system"; other tabs sync through the storage event.
  const media = matchMedia(DARK_QUERY)
  const onMedia = () => readTheme() === "system" && applyTheme("system")
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    applyTheme(readTheme())
    listener()
  }
  media.addEventListener("change", onMedia)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", onMedia)
    window.removeEventListener("storage", onStorage)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light")
}
