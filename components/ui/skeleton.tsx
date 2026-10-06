import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,transparent_0%,var(--surface)_50%,transparent_100%)] bg-size-[200%_100%] bg-no-repeat", className)}
      {...props}
    />
  )
}

export { Skeleton }
