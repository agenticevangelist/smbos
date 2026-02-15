import { NextRequest, NextResponse } from 'next/server';
import { NanoClawBridge } from '@/lib/nanoclaw-bridge';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    await NanoClawBridge.trackUsage({
      skillId: data.skillId,
      params: data.params || {},
      resultCount: data.resultCount || 0,
      timestamp: data.timestamp || new Date().toISOString(),
      userId: data.userId
    });
    
    console.log('SMBOS Usage Tracked (NanoClaw):', data.skillId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tracking Error:', error);
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
  }
}
