"use client"

import { Button } from "@/components/ui/button"
import { useToast, type ToastType } from "@/components/ui/toast"

const examples: { type: ToastType; label: string; title: string; description: string }[] = [
  { type: "success", label: "Success", title: "Deal moved to Won", description: "Lumen Health · $27,500" },
  { type: "info", label: "Info", title: "Sync scheduled", description: "Contacts will refresh in a few minutes." },
  { type: "error", label: "Error", title: "Couldn't save changes", description: "Check your connection and try again." },
]

function ToastDemo() {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((example) => (
        <Button
          key={example.type}
          variant="secondary"
          onClick={() =>
            toast.add({
              type: example.type,
              title: example.title,
              description: example.description,
            })
          }
        >
          {example.label} toast
        </Button>
      ))}
    </div>
  )
}

export { ToastDemo }
