import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'lead-gen-agent',
      name: 'Lead Generation Expert',
      role: 'Specialized in finding and validating leads from Google Maps',
      skills: ['google-maps-leads'],
    }
  ]);
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ success: true });
}
