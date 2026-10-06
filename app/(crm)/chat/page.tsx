import { redirect } from "next/navigation"

import { EmptyState } from "@/components/crm/empty-state"
import { requirePermission } from "@/lib/auth/dal"
import { getChannelList } from "@/lib/chat/queries"
import { MessagesSquareIcon } from "lucide-react"

/** Opens the first conversation (General). */
export default async function ChatIndexPage() {
  const user = await requirePermission("chat", "READ")
  const channels = await getChannelList(user)
  if (channels[0]) redirect(`/chat/${channels[0].id}`)
  return <EmptyState icon={MessagesSquareIcon} title="No conversations." description="Chat isn't available for your role." />
}
