import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { useWakeLock } from '../../hooks/useWakeLock';
import { freshRestClock, restClockReducer, restoreRestClock, type RestAction, type RestClock, type RestRequest } from '../../lib/rest-timer';
import { timerAudio } from '../../lib/timer-audio';
import { ClockIcon, XIcon } from './icons';

const STORAGE_KEY = 'trenirovki:rest-clock:v1';
const PRESETS = [60, 90, 120];
const fmtClock = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
function readClock(): RestClock {
  try { return restoreRestClock(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), Date.now()); }
  catch { return freshRestClock(); }
}

/** Mounted once in App: navigation, editors and page reloads preserve the rest. */
export default function RestTimer({ request }: { request: RestRequest | null }) {
  const { t } = useT();
  const [clock, setClock] = useState(readClock);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [soundFailed, setSoundFailed] = useState(false);
  const lastNonce = useRef(0);
  const item = useRef<string | null>(null);
  const notified = useRef<number | null>(null);
  const running = clock.status === 'running';
  const finished = clock.status === 'finished';
  useWakeLock(running);
  const update = (action: RestAction) => setClock((previous) => restClockReducer(previous, action));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clock)); } catch { /* current timer still works */ }
  }, [clock]);

  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;
    lastNonce.current = request.nonce;
    const sameItem = item.current === request.itemId;
    item.current = request.itemId;
    if (!request.autostart) { setOpen(true); setClosing(false); }
    const now = Date.now();
    setClock((previous) => {
      if (!request.autostart && sameItem && previous.status === 'running') return previous;
      const next = freshRestClock(request.seconds);
      return request.autostart ? restClockReducer(next, { type: 'start', now }) : next;
    });
  }, [request]);

  useEffect(() => {
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
    const interval = window.setInterval(() => update({ type: 'tick', now: Date.now() }), 200);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running && !finished) return;
    const recover = () => {
      if (document.visibilityState !== 'visible') return;
      update({ type: 'tick', now: Date.now() });
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

  const closeSheet = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setOpen(false);
    else setClosing(true);
  };
  const start = () => {
    timerAudio.setDeadline(null);
    void timerAudio.prepare();
    update({ type: 'start', now: Date.now() });
  };
  const reset = () => { timerAudio.setDeadline(null); update({ type: 'reset' }); };
  const dismiss = () => { reset(); setOpen(false); setClosing(false); };

  return <>
    {!open && clock.status !== 'idle' && <div
      className={'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center rounded-2xl px-2 py-1 shadow-md md:bottom-8 ' +
        (finished ? 'bg-ok-soft text-ok-text' : 'bg-accent text-accent-fg')}>
      <button type="button" onClick={() => { setClosing(false); setOpen(true); }} aria-label={t.timer.openAria}
        className="flex min-h-[4.5rem] min-w-36 items-center justify-center gap-3 px-3 py-2">
        <ClockIcon size={27} />
        <span className="text-center">
          <span aria-live="off" className="block text-3xl font-extrabold leading-none tabular-nums">{fmtClock(clock.remaining)}</span>
          {(finished || clock.status === 'paused') && <span role={finished ? 'status' : undefined} className="mt-1 block text-xs font-semibold">{finished ? t.timer.finished : t.timer.pause}</span>}
        </span>
      </button>
      {finished && <button type="button" onClick={dismiss} aria-label={t.timer.dismiss} className="flex h-11 w-11 items-center justify-center rounded-xl"><XIcon size={20} /></button>}
    </div>}

    {open && <div className="fixed inset-0 z-40" onKeyDown={(event) => { if (event.key === 'Escape') closeSheet(); }}>
      <button type="button" aria-label={t.timer.closeAria} onClick={closeSheet}
        className={'anim-fade absolute inset-0 h-full w-full cursor-default bg-bg/70 backdrop-blur-sm ' + (closing ? 'anim-fade-out' : '')} />
      <div role="dialog" aria-modal="true" aria-label={t.timer.title}
        onTransitionEnd={(event) => {
          if (closing && event.target === event.currentTarget && event.propertyName === 'transform') { setOpen(false); setClosing(false); }
        }}
        className={'anim-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ' + (closing ? 'anim-sheet-out' : '')}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.timer.title}</h2>
          <button type="button" onClick={closeSheet} aria-label={t.close} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted"><XIcon /></button>
        </div>
        <div aria-live="off" className={'py-5 text-center text-[clamp(5.5rem,30vw,9rem)] font-extrabold leading-none tracking-tight tabular-nums ' + (finished ? 'text-ok-text' : '')}>{fmtClock(clock.remaining)}</div>
        {finished && <p role="status" className="mb-4 text-center text-lg font-semibold text-ok-text">{t.timer.finished}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESETS.map((seconds) => <button key={seconds} type="button" onClick={() => update({ type: 'duration', seconds, now: Date.now() })}
            className={'min-h-11 rounded-xl border px-4 py-2 font-medium tabular-nums ' + (clock.duration === seconds ? 'border-accent bg-accent-soft' : 'border-border bg-bg')}>{fmtClock(seconds)}</button>)}
          <button type="button" onClick={() => update({ type: 'add', now: Date.now() })} className="min-h-11 rounded-xl border border-border bg-bg px-4 py-2 font-medium">{t.timer.plus15}</button>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={running ? () => update({ type: 'pause', now: Date.now() }) : start}
            className="min-h-12 flex-1 rounded-xl bg-accent px-4 py-2.5 text-lg font-semibold text-accent-fg">{running ? t.timer.pause : t.timer.start}</button>
          <button type="button" onClick={finished ? dismiss : reset} className="min-h-12 rounded-xl border border-border bg-card px-5 py-2.5 font-medium text-muted">{finished ? t.timer.dismiss : t.timer.reset}</button>
        </div>
        <button type="button" onClick={() => { void timerAudio.test().then((ok) => setSoundFailed(!ok)); }} className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-accent">{t.timer.testSound}</button>
        <p className="text-center text-xs text-muted">{soundFailed ? t.timer.soundUnavailable : t.timer.foregroundHint}</p>
      </div>
    </div>}
  </>;
}
