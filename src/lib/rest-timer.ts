export interface RestRequest {
  itemId: string;
  seconds: number;
  nonce: number;
  autostart?: boolean;
}

export interface RestClock {
  duration: number;
  remaining: number;
  endAt: number | null;
  status: 'idle' | 'running' | 'paused' | 'finished';
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

export function freshRestClock(duration = DEFAULT_REST_SECONDS): RestClock {
  return { duration, remaining: duration, endAt: null, status: 'idle' };
}

export type RestAction =
  | { type: 'tick' | 'start' | 'pause' | 'add'; now: number }
  | { type: 'duration'; seconds: number; now: number }
  | { type: 'reset' };

export function restClockReducer(clock: RestClock, action: RestAction): RestClock {
  if (action.type === 'reset') return freshRestClock(clock.duration);
  if (action.type === 'duration') {
    const next = freshRestClock(action.seconds);
    return clock.status === 'running' ? { ...next, endAt: action.now + action.seconds * 1000, status: 'running' } : next;
  }
  if (action.type === 'start') {
    const seconds = clock.remaining > 0 ? clock.remaining : clock.duration;
    return { ...clock, remaining: seconds, endAt: action.now + seconds * 1000, status: 'running' };
  }
  if (action.type === 'add') {
    return clock.status === 'running' && clock.endAt != null
      ? { ...clock, endAt: Math.max(clock.endAt, action.now) + 15_000,
          remaining: Math.ceil((Math.max(clock.endAt, action.now) + 15_000 - action.now) / 1000) }
      : { ...clock, remaining: clock.remaining + 15, endAt: null, status: clock.status === 'paused' ? 'paused' : 'idle' };
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
      !['idle', 'running', 'paused', 'finished'].includes(clock.status)) return freshRestClock();
  if (clock.status === 'running' || clock.status === 'finished') {
    if (!Number.isFinite(clock.endAt) || clock.endAt == null || clock.endAt < now - 6 * 3600_000 || clock.endAt > now + 3600_000) return freshRestClock();
    return clock.endAt <= now ? { ...clock, remaining: 0, status: 'finished' }
      : restClockReducer(clock, { type: 'tick', now });
  }
  return { ...clock, endAt: null };
}
