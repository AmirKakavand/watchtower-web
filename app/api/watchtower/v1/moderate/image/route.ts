import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Mock random moderation result for demo purposes
  const randomScore = Math.random();
  const decision = randomScore > 0.85 ? "BLOCK" : "ALLOW";

  return NextResponse.json({
    decision,
    nsfwScore: randomScore,
    reasons: decision === "BLOCK" ? ["mock_nsfw_detected"] : [],
  });
}
