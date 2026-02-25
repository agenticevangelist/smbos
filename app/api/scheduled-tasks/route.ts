import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'daily-leads',
      agentId: 'lead-gen-agent',
      skillId: 'google-maps-leads',
      cron: '0 9 * * 1-5',
      status: 'active'
    }
  ]);
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true });
}
