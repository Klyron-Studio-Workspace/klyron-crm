import { handleMcp, validMcpToken } from "@/lib/mcp/server"

export async function POST(request: Request) {
  if (!(await validMcpToken(request.headers.get("authorization")))) return new Response("Unauthorized", { status: 401 })
  try {
    const response = await handleMcp(await request.json())
    return response ? Response.json(response) : new Response(null, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request"
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32602, message } }, { status: 400 })
  }
}
