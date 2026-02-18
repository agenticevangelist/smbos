export type SkillEventType = 'skill:executing' | 'skill:completed' | 'skill:error' | 'skill:navigate';

export interface SkillEvent {
  type: SkillEventType;
  skillId: string;
  params?: Record<string, any>;
  results?: any;
  error?: string;
  source: 'agent' | 'ui';
}

type Handler = (event: SkillEvent) => void;

class SkillEventBus {
  private handlers = new Map<SkillEventType, Set<Handler>>();

  on(type: SkillEventType, handler: Handler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: SkillEventType, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit(event: SkillEvent): void {
    this.handlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (e) {
        console.error('[SkillEventBus] Handler error:', e);
      }
    });
  }
}

export const skillEvents = new SkillEventBus();
