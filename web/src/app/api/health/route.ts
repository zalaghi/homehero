import { getPrisma } from "@/server/db/prisma";
export async function GET() {
  try { await getPrisma().$queryRaw`SELECT 1`; return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ ok: false }, { status: 503 }); }
}
