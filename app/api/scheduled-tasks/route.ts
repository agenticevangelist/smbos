import { NextRequest, NextResponse } from 'next/server';
import { NanoClawBridge } from '@/lib/nanoclaw-bridge';

export async function GET() {
  try {
    const tasks = await NanoClawBridge.listTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    await NanoClawBridge.createTask({
      id: data.id || `task-${Date.now()}`,
      agentId: data.agentId,
      skillId: data.skillId,
      prompt: data.prompt || `Execute skill ${data.skillId}`,
      params: data.params || {},
      cron: data.cron,
      status: 'active'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
