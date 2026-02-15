import { NextResponse } from 'next/server';
import { NanoClawBridge } from '@/lib/nanoclaw-bridge';

export async function GET() {
  try {
    const analysis = await NanoClawBridge.analyzeUsage();
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze usage' }, { status: 500 });
  }
}
