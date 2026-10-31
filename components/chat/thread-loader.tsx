import { MessageThread } from "@/components/chat/message-thread"
import { Skeleton } from "@/components/ui/skeleton"
import { getMessages } from "@/lib/chat/queries"

type ThreadLoaderProps = Omit<React.ComponentProps<typeof MessageThread>, "initialMessages" | "initialHasMore">

/**
 * Fetches the newest chunk of messages. Wrapped in <Suspense> by the chat pages, so the
 * header and conversation list show at once and the messages stream in behind them.
 */
async function ThreadLoader(props: ThreadLoaderProps) {
  const page = await getMessages(props.channelId)
  return <MessageThread {...props} initialMessages={page.messages} initialHasMore={page.hasMore} />
}

/** Placeholder bubbles while the first chunk loads. */
function ThreadSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="flex min-h-0 flex-1 flex-col justify-end gap-5 overflow-hidden px-3 py-4">
      {[48, 72, 36, 60, 44].map((width, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3" style={{ width: `${width}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export { ThreadLoader, ThreadSkeleton }
