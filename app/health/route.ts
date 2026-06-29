import { NextResponse } from "next/server";

/** AWS ECS/ALB health check — path `/health` per terraform `api_health_check_path`. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
