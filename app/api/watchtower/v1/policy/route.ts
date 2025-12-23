import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    blockToxicity: true,
    blockSexual: true,
    blockNsfwImages: true,
    toxicityThreshold: 0.85,
    sexualThreshold: 0.9,
    nsfwThreshold: 0.85,
  });
}
