import { requireTeamUser } from "@/lib/auth/dal"
import { RealtimeProvider } from "@/components/realtime/realtime-provider"

export default async function CanvasLayout({ children }: LayoutProps<"/">) {
  await requireTeamUser()
  return <RealtimeProvider><main className="h-svh w-screen overflow-hidden bg-[#f7f7f7]">{children}</main></RealtimeProvider>
}
