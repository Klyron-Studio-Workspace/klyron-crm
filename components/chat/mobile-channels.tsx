"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { MessagesSquareIcon } from "lucide-react"

import { ChannelList } from "@/components/chat/channel-list"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

/** Conversation list in a sheet, for screens too narrow for the side column. */
function MobileChannels(props: React.ComponentProps<typeof ChannelList>) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const [lastPath, setLastPath] = React.useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Conversations" />}>
        <MessagesSquareIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetTitle className="sr-only">Conversations</SheetTitle>
        <ChannelList {...props} />
      </SheetContent>
    </Sheet>
  )
}

export { MobileChannels }
