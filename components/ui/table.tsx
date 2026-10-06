"use client"

import * as React from "react"
import { cn } from "cn"

type TableDensity = "default" | "compact"

function Table({
  className,
  containerClassName,
  density = "default",
  ...props
}: React.ComponentProps<"table"> & {
  /** Classes for the scroll container, e.g. `max-h-[480px]` to enable the sticky header. */
  containerClassName?: string
  density?: TableDensity
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-auto rounded-xl border border-border bg-card",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        data-density={density}
        className={cn(
          "group/table w-full caption-bottom border-separate border-spacing-0 text-sm tabular-nums",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 bg-surface", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child>td]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-surface font-medium [&>tr>td]:border-t [&>tr>td]:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors duration-150 ease-out [tbody>&]:hover:bg-surface has-aria-expanded:bg-surface data-[state=selected]:bg-primary-tint",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 border-b border-border px-4 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground group-data-[density=compact]/table:h-8 group-data-[density=compact]/table:px-3 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-border px-4 py-3 align-middle whitespace-nowrap group-data-[density=compact]/table:px-3 group-data-[density=compact]/table:py-1.5 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
export type { TableDensity }
