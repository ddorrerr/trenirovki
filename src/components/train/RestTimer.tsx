import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { useApp } from '../../store';
import { useWakeLock } from '../../hooks/useWakeLock';
import { freshRestClock, parseRestSeconds, restClockReducer, restoreRestClock, type RestAction, type RestClock, type RestRequest } from '../../lib/rest-timer';
import { confirmTimedSet } from '../../lib/timed-sets';
import { timerAudio } from '../../lib/timer-audio';
import { CheckIcon } from './icons';

const STORAGE_KEY = 'trenirovki:rest-clock:v1';
const PRESETS = [60, 90, 120];
export const fmtClock = (seconds: number) => `${Math.floor(Math.max(0, Math.ceil(seconds)) / 60)}:${String(Math.max(0, Math.ceil(seconds)) % 60).padStart(2, '0')}`;
function readClock(): RestClock {
  try { return restoreRestClock(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), Date.now()); }
  catch { return freshRestClock(); }
}

export function TimerIcon({ name }: { name: 'play' | 'pause' | 'reset' | 'expand' | 'minimize' }) {
  const paths = {
    play: 'M9 5l10 7-10 7Z', pause: 'M8 5v14M16 5v14', reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
    expand: 'M14 4h6v6M20 4l-7 7M4 14v6h6M4 20l7-7', minimize: 'M4 10h6V4M10 10L4 4M14 20v-6h6M14 14l6 6',
  };
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function Dial({ clock, now, compact = false }: { clock: RestClock; now: number; compact?: boolean }) {
  const preparing = clock.status === 'preparing';
  const finished = clock.status === 'finished';
  const remaining = preparing ? Math.max(0, ((clock.preparingUntil ?? now) - now) / 1000)
    : clock.status === 'running' && clock.endAt != null ? Math.max(0, (clock.endAt - now) / 1000) : clock.remaining;
  const fraction = remaining / (preparing ? 3 : clock.span ?? clock.duration);
  return <span aria-live="off" className={`timer-dial ${compact ? 'timer-dial--small' : ''} ${finished ? 'timer-dial--finished' : ''} ${preparing ? 'timer-dial--preparing' : ''}`}>
    <svg className="timer-dial__ring" viewBox="0 0 240 240" aria-hidden="true">
      <circle className="timer-dial__track" cx="120" cy="120" r="110" />
      <circle className="timer-dial__progress" cx="120" cy="120" r="110" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - Math.min(1, Math.max(0, finished ? 1 : fraction)))} />
    </svg>
    <span className="timer-dial__time">{finished ? <CheckIcon size={compact ? 30 : 62} /> : preparing ? Math.ceil(remaining) : fmtClock(remaining)}</span>
  </span>;
}

/** One root-mounted clock; purpose and set identity survive navigation and reloads. */
export default function RestTimer({ request }: { request: RestRequest | null }) {
  const { t } = useT();
  const { workouts, saveWorkout } = useApp();
  const [clock, setClock] = useState(readClock);
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(false);
  const [soundFailed, setSoundFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastNonce = useRef(0);
  const notified = useRef<number | null>(null);
  const confirming = useRef(false);
  const preparing = clock.status === 'preparing';
  const running = clock.status === 'running' || preparing;
  const finished = clock.status === 'finished';
  const isSet = clock.context?.kind === 'set';
  useWakeLock(running);
  const update = (action: RestAction) => setClock(previous => restClockReducer(previous, action));
  const minimise = () => setOpen(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clock)); } catch { /* timer still works */ }
  }, [clock]);

  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;
    lastNonce.current = request.nonce;
    confirming.current = false;
    if (!request.autostart) setOpen(true);
    const timestamp = Date.now();
    setNow(timestamp);
    setClock(previous => {
      const context = request.context ?? { kind: 'rest' as const, itemId: request.itemId };
      const same = previous.context?.itemId === request.itemId && previous.context?.kind === context.kind &&
        previous.context?.workoutId === context.workoutId && previous.context?.setIndex === context.setIndex && previous.duration === request.seconds;
      if (!request.autostart && same && previous.status !== 'idle') return previous;
      const next = freshRestClock(request.seconds, context);
      return request.autostart ? restClockReducer(next, { type: 'start', now: timestamp }) : next;
    });
  }, [request]);

  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.current?.close(); document.body.style.overflow = overflow; };
  }, [open]);

  useEffect(() => {
    // Preparation is included in the final deadline: background delays never extend a hold.
    timerAudio.setDeadline(running || finished ? clock.endAt : null);
    if (finished) {
      timerAudio.complete();
      if (notified.current !== clock.endAt) {
        notified.current = clock.endAt;
        try { navigator.vibrate?.([180, 100, 180]); } catch { /* unsupported */ }
      }
    }
  }, [clock.endAt, running, finished]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const timestamp = Date.now(); setNow(timestamp); update({ type: 'tick', now: timestamp });
    }, 100);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running && !finished) return;
    const recover = () => {
      if (document.visibilityState !== 'visible') return;
      const timestamp = Date.now(); setNow(timestamp); update({ type: 'tick', now: timestamp });
      void timerAudio.prepare();
    };
    const unlock = () => { void timerAudio.prepare(); };
    document.addEventListener('visibilitychange', recover);
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('focus', recover);
    window.addEventListener('pageshow', recover);
    return () => {
      document.removeEventListener('visibilitychange', recover);
      document.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('focus', recover);
      window.removeEventListener('pageshow', recover);
    };
  }, [running, finished]);
  useEffect(() => () => timerAudio.dispose(), []);

  const start = () => {
    timerAudio.setDeadline(null);
    void timerAudio.prepare();
    const timestamp = Date.now(); setNow(timestamp); update({ type: 'start', now: timestamp });
  };
  const reset = () => { timerAudio.setDeadline(null); update({ type: 'reset' }); };
  const dismiss = () => { reset(); setOpen(false); };
  const context = clock.context;
  const workout = workouts.find(value => value.id === context?.workoutId);
  const confirmedWorkout = isSet && workout && context?.setIndex != null
    ? confirmTimedSet(workout, context.itemId, context.setIndex, clock.duration) : null;
  const complete = () => {
    if (confirming.current) return;
    if (!confirmedWorkout || !context) { dismiss(); return; }
    confirming.current = true;
    saveWorkout(confirmedWorkout);
    const seconds = parseRestSeconds(confirmedWorkout.items.find(value => value.id === context.itemId)?.rest ?? null);
    const timestamp = Date.now();
    timerAudio.setDeadline(null); void timerAudio.prepare(); setNow(timestamp);
    setClock(restClockReducer(freshRestClock(seconds, { kind: 'rest', itemId: context.itemId, workoutId: context.workoutId }), { type: 'start', now: timestamp }));
    setOpen(false);
  };
  const phase = preparing ? t.timer.getReady : finished ? (isSet ? t.timer.setFinished : t.timer.finished)
    : clock.status === 'paused' ? t.timer.pause : '';

  return <>
    {!open && clock.status !== 'idle' && <div className="timer-dock-position">
      <button type="button" className="timer-dock" onClick={() => setOpen(true)} aria-label={t.timer.openAria}>
        <Dial clock={clock} now={now} compact />
        <span className="timer-dock__label">{clock.status === 'paused' ? t.timer.pause : isSet ? t.timer.setTitle : t.timer.title}</span>
        <span className="timer-dock__expand"><TimerIcon name="expand" /></span>
        {finished && <span className="sr-only" role="status">{phase}</span>}
      </button>
    </div>}
    <dialog ref={dialog} className="workout-timer-dialog" aria-labelledby="timer-title"
      onCancel={event => { event.preventDefault(); minimise(); }} onClose={minimise}>
      <div className="workout-timer-panel">
        <header className="workout-timer-header">
          <h2 id="timer-title" className="min-w-0 break-words text-base font-bold">{isSet ? t.catalog.exercise(context?.exerciseName ?? t.timer.setTitle) : t.timer.title}</h2>
          <button type="button" onClick={minimise} aria-label={t.timer.minimise} className="timer-control timer-control--secondary shrink-0"><TimerIcon name="minimize" /></button>
        </header>
        <div className="workout-timer-body">
          <p className="mb-6 text-sm text-muted">{isSet ? t.timer.setNumber((context?.setIndex ?? 0) + 1, context?.totalSets ?? 1) : t.timer.betweenSets}</p>
          <Dial clock={clock} now={now} />
          <p role="status" className={'timer-phase ' + (finished ? 'text-ok-text' : '')}>{phase}</p>
          <div className="timer-controls">
            <button type="button" className="timer-control timer-control--secondary" onClick={reset} aria-label={t.timer.reset}><TimerIcon name="reset" /></button>
            <button type="button" className="timer-control timer-control--primary" onClick={running ? () => update({ type: 'pause', now: Date.now() }) : start} aria-label={running ? t.timer.pause : t.timer.start}><TimerIcon name={running ? 'pause' : 'play'} /></button>
            <button type="button" className="timer-control timer-control--secondary" onClick={() => update({ type: 'add', now: Date.now() })} disabled={preparing || clock.remaining > 3585} aria-label={t.timer.plus15}>+15</button>
          </div>
          <div className="timer-feedback">
            {finished ? <button type="button" className="min-h-12 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-fg" onClick={isSet ? complete : dismiss}>{isSet && confirmedWorkout ? t.timer.confirmSet : t.timer.dismiss}</button>
              : isSet ? <p className="text-center text-xs text-muted">{clock.status === 'idle' ? t.timer.preparationHint : `${t.timer.title} · ${fmtClock(context?.restSeconds ?? 90)}`}</p>
              : <div className="flex gap-2">{PRESETS.map(seconds => <button type="button" key={seconds} onClick={() => update({ type: 'duration', seconds, now: Date.now() })} className={'min-h-11 rounded-xl px-4 py-2 text-sm tabular-nums ' + (clock.duration === seconds ? 'bg-accent-soft font-bold text-accent' : 'text-muted')}>{fmtClock(seconds)}</button>)}</div>}
          </div>
        </div>
        <footer className="workout-timer-footer">
          <details className="text-center text-xs text-muted"><summary className="cursor-pointer py-3">{t.timer.sound}</summary>
            <button type="button" onClick={() => { void timerAudio.test().then(ok => setSoundFailed(!ok)); }} className="min-h-11 text-sm font-semibold text-accent">{t.timer.testSound}</button>
            <p>{soundFailed ? t.timer.soundUnavailable : t.timer.foregroundHint}</p>
          </details>
          <button type="button" onClick={minimise} className="min-h-12 w-full text-sm text-muted">{t.timer.backToPlan} <span aria-hidden="true">↓</span></button>
        </footer>
      </div>
    </dialog>
  </>;
}
