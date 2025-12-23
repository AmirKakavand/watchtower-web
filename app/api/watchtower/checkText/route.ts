import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const text = body.text.toLowerCase();

  // Simple mock logic
  const isToxic =
    text.includes("nigger") ||
    text.includes("kill") ||
    text.includes("fuck") ||
    text.includes("fucking");

  return NextResponse.json({
    isTextPermitted: !isToxic,
    mockReason: isToxic ? "Contains prohibited keywords" : "Clean",
  });
}
