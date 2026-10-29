import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getVapidConfig } from "@/server/notifications/push";
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = getVapidConfig();
  return NextResponse.json({ publicKey: config?.publicKey ?? null }, { headers: { "Cache-Control": "no-store" } });
}
