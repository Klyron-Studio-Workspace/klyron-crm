import { KlyronMark, KlyronWordmark } from "@/components/brand/klyron-mark"

type AuthShellProps = {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}

/** Editorial split layout shared by login, password reset and forced password change. */
function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <KlyronMark className="size-7" decorative />
          <KlyronWordmark />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-5xl font-medium tracking-normal text-foreground">
              {title}
            </h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>

        <p className="text-xs text-muted-foreground">
          Internal tool. Access is limited to Klyron Studio members and clients.
        </p>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-surface p-12 lg:flex">
        <KlyronMark className="size-10" decorative />
        <figure className="max-w-md">
          <blockquote className="font-serif text-4xl leading-tight font-medium text-foreground">
            Fewer, better clients. Every conversation, one place.
          </blockquote>
          <figcaption className="mt-6 text-sm text-muted-foreground">Klyron Studio CRM</figcaption>
        </figure>
      </aside>
    </main>
  )
}

export { AuthShell }
