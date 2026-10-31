export interface RestRequest {
  itemId: string;
  seconds: number;
  nonce: number;
  autostart?: boolean;
  context?: TimerContext;
}

export interface TimerContext {
  kind: 'rest' | 'set';
  itemId: string;
  workoutId?: string;
  exerciseName?: string;
  setIndex?: number;
  totalSets?: number;
  restSeconds?: number;
}

export interface RestClock {
  duration: number;
  remaining: number;
  endAt: number | null;
  status: 'idle' | 'preparing' | 'running' | 'paused' | 'finished';
  context?: TimerContext;
  preparingUntil?: number;
  span?: number;
}

export const DEFAULT_REST_SECONDS = 90;

export function parseRestSeconds(rest: string | null): number {
  if (!rest) return DEFAULT_REST_SECONDS;
  const trimmed = rest.trim();
  const mmss = /^(\d+)[.,:](\d{2})(?:\s*мин)?$/.exec(trimmed);
  if (mmss && Number(mmss[2]) < 60) {
    const total = Number(mmss[1]) * 60 + Number(mmss[2]);
    if (total >= 5 && total <= 1200) return total;
  }
  const match = /(\d+(?:[.,]\d+)?)/.exec(trimmed);
  if (!match) return DEFAULT_REST_SECONDS;
  const value = Number(match[1].replace(',', '.'));
  const after = trimmed.slice(match.index + match[1].length);
  const seconds = Math.round(value * (/^\s*сек/i.test(after) ? 1 : 60));
  return seconds >= 5 && seconds <= 1200 ? seconds : DEFAULT_REST_SECONDS;
}

export function freshRestClock(duration = DEFAULT_REST_SECONDS, context?: TimerContext): RestClock {
  return { duration, remaining: duration, endAt: null, status: 'idle', ...(context ? { context } : {}) };
}

export type RestAction =
  | { type: 'tick' | 'start' | 'pause' | 'add'; now: number }
  | { type: 'duration'; seconds: number; now: number }
  | { type: 'reset' };

export function restClockReducer(clock: RestClock, action: RestAction): RestClock {
  if (action.type === 'reset') return freshRestClock(clock.duration, clock.context);
  if (action.type === 'duration') {
    const next = freshRestClock(action.seconds, clock.context);
    return clock.status === 'running' ? { ...next, endAt: action.now + action.seconds * 1000, status: 'running' } : next;
  }
  if (action.type === 'start') {
    if (clock.status === 'running' || clock.status === 'preparing') return clock;
    const seconds = clock.remaining > 0 ? clock.remaining : clock.duration;
    if (clock.context?.kind === 'set' && clock.status !== 'paused') {
      return { ...clock, remaining: seconds, span: seconds, preparingUntil: action.now + 3000,
        endAt: action.now + (seconds + 3) * 1000, status: 'preparing' };
    }
    return { ...clock, remaining: seconds, endAt: action.now + seconds * 1000, status: 'running' };
  }
  if (action.type === 'add') {
    if (clock.status === 'preparing' || clock.remaining > 3585) return clock;
    const span = Math.max(clock.span ?? clock.duration, clock.remaining) + 15;
    return clock.status === 'running' && clock.endAt != null
      ? { ...clock, span, endAt: Math.max(clock.endAt, action.now) + 15_000,
          remaining: Math.ceil((Math.max(clock.endAt, action.now) + 15_000 - action.now) / 1000) }
      : { ...clock, span, remaining: clock.remaining + 15, endAt: null, status: clock.status === 'paused' || clock.status === 'finished' ? 'paused' : 'idle' };
  }
  if (clock.status === 'preparing') {
    if (action.type === 'pause') return freshRestClock(clock.duration, clock.context);
    if (clock.preparingUntil != null && action.now < clock.preparingUntil) return clock;
    clock = { ...clock, status: 'running' };
  }
  if (clock.status !== 'running' || clock.endAt == null) return clock;
  const remaining = Math.max(0, Math.ceil((clock.endAt - action.now) / 1000));
  if (!remaining) return { ...clock, remaining: 0, status: 'finished' };
  if (action.type === 'pause') return { ...clock, remaining, endAt: null, status: 'paused' };
  return remaining === clock.remaining ? clock : { ...clock, remaining };
}

export function restoreRestClock(value: unknown, now: number): RestClock {
  if (!value || typeof value !== 'object') return freshRestClock();
  const clock = value as RestClock;
  if (!Number.isFinite(clock.duration) || clock.duration < 5 || clock.duration > 1200 ||
      !Number.isFinite(clock.remaining) || clock.remaining < 0 || clock.remaining > 3600 ||
      !['idle', 'preparing', 'running', 'paused', 'finished'].includes(clock.status)) return freshRestClock();
  if (clock.context && (!['rest', 'set'].includes(clock.context.kind) || typeof clock.context.itemId !== 'string' ||
      (clock.context.kind === 'set' && (typeof clock.context.workoutId !== 'string' || !Number.isInteger(clock.context.setIndex) ||
      clock.context.setIndex! < 0 || clock.context.setIndex! > 49 || !Number.isInteger(clock.context.totalSets) || clock.context.totalSets! < 1 || clock.context.totalSets! > 50)))) return freshRestClock();
  if (clock.span != null && (!Number.isFinite(clock.span) || clock.span < 5 || clock.span > 7200)) return freshRestClock();
  if (clock.status === 'preparing' && (clock.context?.kind !== 'set' || !Number.isFinite(clock.preparingUntil) ||
      clock.preparingUntil! > now + 3000 || clock.endAt == null || clock.preparingUntil! >= clock.endAt)) return freshRestClock();
  if (clock.status === 'running' || clock.status === 'preparing' || clock.status === 'finished') {
    if (!Number.isFinite(clock.endAt) || clock.endAt == null || clock.endAt < now - 6 * 3600_000 || clock.endAt > now + 3600_000) return freshRestClock();
    return clock.endAt <= now ? { ...clock, remaining: 0, status: 'finished' }
      : restClockReducer(clock, { type: 'tick', now });
  }
  return { ...clock, endAt: null };
}
