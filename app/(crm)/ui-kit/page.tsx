import type { Metadata } from "next"
import { InboxIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { EmptyState } from "@/components/crm/empty-state"
import { StageBadge } from "@/components/leads/stage-badge"
import { defaultStages } from "@/lib/leads/constants"
import { StatCard } from "@/components/crm/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToastDemo } from "./toast-demo"

export const metadata: Metadata = { title: "UI kit" }

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function UiKitPage() {
  return (
    <>
      <PageHeader
        title="UI kit"
        description="Reference for every Klyron CRM primitive. Use it for visual QA."
      />

      <Section title="Buttons" description="36px default, 40px large. Crimson only for the primary action.">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <PlusIcon data-icon="inline-start" />
            Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2Icon data-icon="inline-start" />
            Destructive
          </Button>
          <Button variant="link">Text link</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg">Large primary</Button>
          <Button size="lg" variant="secondary">Large secondary</Button>
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="icon" variant="secondary" aria-label="More">
            <MoreHorizontalIcon />
          </Button>
        </div>
      </Section>

      <Section title="Pipeline stages" description="Soft tints with matching text. Never saturated fills.">
        <div className="flex flex-wrap gap-2">
          {defaultStages.map((stage) => (
            <StageBadge key={stage.name} name={stage.name} tone={stage.tone} muted={stage.kind === "LOST"} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Key</Badge>
          <Badge variant="brand">Priority</Badge>
          <Badge variant="success">Paid</Badge>
          <Badge variant="warning">Due soon</Badge>
          <Badge variant="info">Synced</Badge>
          <Badge variant="neutral">Draft</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Overdue</Badge>
        </div>
      </Section>

      <Section title="Stat tiles">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open pipeline" value="$97,000" delta="+12.4%" hint="vs. last 30 days" />
          <StatCard label="Win rate" value="38%" delta="-4.0%" trend="down" positive={false} hint="vs. last quarter" />
          <StatCard label="Active clients" value="23" />
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-name">Full name</Label>
            <Input id="kit-name" placeholder="Jane Doe" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-disabled">Disabled</Label>
            <Input id="kit-disabled" disabled defaultValue="Read only" />
          </div>
        </div>
      </Section>

      <Section title="Overlays" description="White surfaces, 1px border, subtle shadow, 12px radius for modals.">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button variant="secondary" />}>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New contact</DialogTitle>
                <DialogDescription>Add someone to the studio’s address book.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-dialog-email">Email</Label>
                <Input id="kit-dialog-email" type="email" placeholder="name@company.com" />
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                <DialogClose render={<Button />}>Save contact</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger render={<Button variant="secondary" />}>Open sheet</SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Deal details</SheetTitle>
                <SheetDescription>Halden &amp; Pike · Negotiation</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4">
                <Label htmlFor="kit-sheet-value">Deal value</Label>
                <Input id="kit-sheet-value" defaultValue="$42,000" />
              </div>
              <SheetFooter>
                <Button>Update deal</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" />}>Open menu</DropdownMenuTrigger>
            <DropdownMenuContent className="w-44">
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Assign owner</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger render={<Button variant="secondary" />}>Hover for tooltip</TooltipTrigger>
            <TooltipContent>Last edited 2 hours ago</TooltipContent>
          </Tooltip>
        </div>
        <ToastDemo />
      </Section>

      <Section title="Loading">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-5" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </Section>

      <Section title="Empty state" description="Cormorant headline, muted description, one primary action.">
        <EmptyState
          icon={InboxIcon}
          title="Nothing here yet."
          description="When clients reply to proposals, their messages land here."
          action={<Button>Connect inbox</Button>}
        />
      </Section>
    </>
  )
}
