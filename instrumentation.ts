/**
 * Runs once when the server starts. Starts the in-process scheduler (follow-up
 * reminders, upload cleanup). Run the app as a single process (PM2 fork mode)
 * so jobs and live updates aren't duplicated.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.DISABLE_SCHEDULER === "1") return
  const { startScheduler } = await import("./lib/scheduler")
  startScheduler()
}
