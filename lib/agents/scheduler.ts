import * as cron from 'node-cron';
import { logEvent } from './logger';
import type { AgentSchedule } from './types';

interface ScheduledJob {
  scheduleId: string;
  task: cron.ScheduledTask;
}

// Map<agentId, ScheduledJob[]>
const activeJobs = new Map<string, ScheduledJob[]>();

export function startScheduler(
  agentId: string,
  port: number,
  schedules: AgentSchedule[]
): number {
  // Stop existing jobs for this agent
  stopScheduler(agentId);

  const jobs: ScheduledJob[] = [];

  for (const schedule of schedules) {
    if (!schedule.enabled || !schedule.cron) continue;

    if (!cron.validate(schedule.cron)) continue;

    const task = cron.schedule(schedule.cron, async () => {
      logEvent(agentId, 'cron:trigger', { scheduleId: schedule.id, action: schedule.action });
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: schedule.action }),
        });
        if (res.ok) {
          logEvent(agentId, 'cron:success', { scheduleId: schedule.id });
        } else {
          logEvent(agentId, 'cron:error', { scheduleId: schedule.id, status: res.status });
        }
      } catch (err) {
        logEvent(agentId, 'cron:error', {
          scheduleId: schedule.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    jobs.push({ scheduleId: schedule.id, task });
  }

  if (jobs.length > 0) {
    activeJobs.set(agentId, jobs);
  }

  return jobs.length;
}

export function stopScheduler(agentId: string): void {
  const jobs = activeJobs.get(agentId);
  if (!jobs) return;

  for (const job of jobs) {
    job.task.stop();
  }
  activeJobs.delete(agentId);
}

export function getActiveSchedules(agentId: string): string[] {
  const jobs = activeJobs.get(agentId);
  if (!jobs) return [];
  return jobs.map(j => j.scheduleId);
}
