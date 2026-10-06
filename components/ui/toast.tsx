"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, XIcon } from "lucide-react"

type ToastType = "default" | "success" | "error" | "info"

const toastIcons: Record<Exclude<ToastType, "default">, React.ReactNode> = {
  success: <CircleCheckIcon className="text-success" />,
  error: <CircleAlertIcon className="text-primary" />,
  info: <InfoIcon className="text-info" />,
}

/** Wrap the app once. Use `useToast().add({ title, description, type })` to show a toast. */
function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider timeout={5000}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className="fixed right-4 bottom-4 z-100 flex w-[calc(100vw-2rem)] flex-col gap-2 outline-none sm:right-6 sm:bottom-6 sm:w-90"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((toast) => {
    const icon = toastIcons[toast.type as keyof typeof toastIcons]
    return (
      <ToastPrimitive.Root
        key={toast.id}
        toast={toast}
        data-slot="toast"
        className="flex items-start gap-3 rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-lg transition-[opacity,translate] duration-200 ease-out outline-none select-none data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0 [&_svg]:size-4 [&_svg]:shrink-0"
      >
        {icon && <span className="mt-0.5">{icon}</span>}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastPrimitive.Title className="font-medium text-foreground" />
          <ToastPrimitive.Description className="text-muted-foreground" />
        </div>
        <ToastPrimitive.Close
          aria-label="Dismiss notification"
          className="-m-1 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <XIcon />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    )
  })
}

function useToast() {
  return ToastPrimitive.useToastManager()
}

export { Toaster, useToast }
export type { ToastType }
