import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ analysis: "System is operating normally. No anomalies detected." });
}
