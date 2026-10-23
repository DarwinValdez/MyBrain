import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { recallErrorResponse, runRecall } from "@/lib/recall";
import { fieldErrors, recallRequestSchema } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = recallRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  try {
    const result = await runRecall(ctx, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = recallErrorResponse(error);
    if (status >= 500) console.error("recall failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
