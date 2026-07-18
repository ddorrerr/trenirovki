// Таймер отдыха: нижняя шторка + плавающая «пилюля», если шторку закрыли,
// а отсчёт ещё идёт. Компонент постоянно смонтирован на экране «Тренировка»,
// поэтому отсчёт не сбрасывается ни прокруткой, ни закрытием шторки.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockIcon, XIcon } from './icons';

/** Запрос открытия таймера: каждый тап по чипу «отдых» — новый nonce. */
export interface RestRequest {
  itemId: string;
  seconds: number;
  nonce: number;
}

const FALLBACK_SECONDS = 90;

/** «1.0» → 60с, «1,5» → 90с, «2 мин» → 120с, «40 сек» → 40с, «1.30» → 90с, мусор → 90с */
export function parseRestSeconds(rest: string | null): number {
  if (!rest) return FALLBACK_SECONDS;
  const trimmed = rest.trim();

  // «1.30» / «1:30» с двумя цифрами после разделителя — это мин:сек
  const mmss = /^(\d+)[.,:](\d{2})(?:\s*мин)?$/.exec(trimmed);
  if (mmss) {
    const ss = Number(mmss[2]);
    if (ss < 60) {
      const total = Number(mmss[1]) * 60 + ss;
      if (total >= 5 && total <= 20 * 60) return total;
    }
  }

  const m = /(\d+(?:[.,]\d+)?)/.exec(trimmed);
  if (!m) return FALLBACK_SECONDS;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return FALLBACK_SECONDS;

  // «40 сек» — число со словом «сек» сразу после — трактуем как секунды
  const after = trimmed.slice(m.index + m[1].length);
  const seconds = /^\s*сек/i.test(after) ? Math.round(n) : Math.round(n * 60);
  if (seconds < 5 || seconds > 20 * 60) return FALLBACK_SECONDS;
  return seconds;
}

function fmtClock(total: number): string {
  const safe = Math.max(0, total);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function beep(ctx: AudioContext | null): void {
  if (!ctx || ctx.state !== 'running') return;
  try {
    const t0 = ctx.currentTime;
    for (const dt of [0, 0.24]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.22);
    }
  } catch {
    /* звук не критичен */
  }
}

const PRESETS: { label: string; seconds: number }[] = [
  { label: '1:00', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2:00', seconds: 120 },
];

export default function RestTimer({ request }: { request: RestRequest | null }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(FALLBACK_SECONDS);
  const [remaining, setRemaining] = useState(FALLBACK_SECONDS);
  const [flash, setFlash] = useState(false);
  /* Закрытие шторки с анимацией: сначала уезжает вниз, потом размонтируется */
  const [closing, setClosing] = useState(false);

  const endAtRef = useRef(0);
  const finishedRef = useRef(false);
  const itemRef = useRef<string | null>(null);
  // Стартуем с nonce текущего request: при перемонтировании (например, после
  // переключения режима редактирования) старый тап не должен переоткрыть шторку.
  const lastNonceRef = useRef(request?.nonce ?? 0);
  const audioRef = useRef<AudioContext | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // Открытие по тапу на чип «отдых»
  useEffect(() => {
    if (!request || request.nonce === lastNonceRef.current) return;
    lastNonceRef.current = request.nonce;
    const sameItem = itemRef.current === request.itemId;
    itemRef.current = request.itemId;
    setClosing(false);
    setOpen(true);
    if (running && sameItem) return; // отсчёт уже идёт — просто показать
    setRunning(false);
    setFlash(false);
    setDuration(request.seconds);
    setRemaining(request.seconds);
  }, [request, running]);

  /* Финиш один раз на запуск: тик и возврат из фона могут сработать вместе.
     После фона AudioContext подвешен — будим и только потом звоним. */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    const ctx = audioRef.current;
    if (ctx && ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => beep(ctx))
        .catch(() => undefined);
    } else {
      beep(ctx);
    }
    setFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(false), 1800);
  }, []);

  // Тик: считаем от метки времени, чтобы прокрутка/троттлинг не сбивали отсчёт
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) finish();
    }, 200);
    return () => window.clearInterval(id);
  }, [running, finish]);

  /* В фоне браузер замораживает таймеры и звук — «дзынь» в другом приложении
     невозможен. Зато по возвращении сразу пересчитываем остаток и, если время
     вышло, пока приложение было свёрнуто, — звоним не дожидаясь тика. */
  useEffect(() => {
    if (!running) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) finish();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [running, finish]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (audioRef.current) void audioRef.current.close().catch(() => undefined);
    },
    [],
  );

  // AudioContext создаём/будим строго в обработчике пользовательского тапа (iOS)
  const ensureAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) audioRef.current = new Ctor();
      }
      if (audioRef.current && audioRef.current.state !== 'running') {
        void audioRef.current.resume().catch(() => undefined);
      }
    } catch {
      /* будет просто без звука */
    }
  }, []);

  /* При reduced-motion анимаций нет — закрываем сразу, не ждём onAnimationEnd */
  const closeSheet = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
  }, []);

  const start = () => {
    ensureAudio();
    setFlash(false);
    finishedRef.current = false;
    const base = remaining > 0 ? remaining : duration;
    if (remaining <= 0) setRemaining(duration);
    endAtRef.current = Date.now() + base * 1000;
    setRunning(true);
  };

  const pause = () => {
    setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setFlash(false);
    setRemaining(duration);
  };

  const applyPreset = (s: number) => {
    ensureAudio();
    setFlash(false);
    setDuration(s);
    setRemaining(s);
    if (running) endAtRef.current = Date.now() + s * 1000;
  };

  const plus15 = () => {
    ensureAudio();
    setFlash(false);
    if (running) {
      endAtRef.current += 15_000;
      setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    } else {
      setRemaining((r) => Math.max(0, r) + 15);
    }
  };

  return (
    <>
      {/* Плавающая пилюля, когда шторка закрыта, а отсчёт идёт */}
      {!open && (running || flash) && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть таймер отдыха"
          className={
            'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full bg-accent px-4 py-3 font-semibold tabular-nums text-accent-fg shadow-lg md:bottom-8 ' +
            (flash ? 'animate-pulse' : '')
          }
        >
          <ClockIcon size={17} />
          {fmtClock(remaining)}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Закрыть таймер"
            onClick={closeSheet}
            className={
              (closing ? 'anim-fade-out' : 'anim-fade') +
              ' absolute inset-0 h-full w-full cursor-default bg-bg/70 backdrop-blur-sm'
            }
          />
          <div
            onAnimationEnd={(e) => {
              if (closing && e.target === e.currentTarget) {
                setOpen(false);
                setClosing(false);
              }
            }}
            className={
              (closing ? 'anim-sheet-out' : 'anim-sheet') +
              ' absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border border-b-0 border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl'
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                Отдых
              </span>
              <button
                onClick={closeSheet}
                aria-label="Закрыть"
                className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted"
              >
                <XIcon />
              </button>
            </div>

            <div
              aria-live="off"
              className={
                'py-4 text-center text-7xl font-extrabold leading-none tabular-nums ' +
                (flash ? 'animate-pulse text-ok-text' : remaining === 0 ? 'text-ok-text' : '')
              }
            >
              {fmtClock(remaining)}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => applyPreset(p.seconds)}
                  className={
                    'min-h-11 rounded-xl border px-4 py-2 font-medium tabular-nums ' +
                    (duration === p.seconds
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-bg')
                  }
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={plus15}
                className="min-h-11 rounded-xl border border-border bg-bg px-4 py-2 font-medium"
              >
                +15 сек
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {running ? (
                <button
                  onClick={pause}
                  className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-lg font-semibold"
                >
                  Пауза
                </button>
              ) : (
                <button
                  onClick={start}
                  className="min-h-12 flex-1 rounded-xl bg-accent px-4 py-2.5 text-lg font-semibold text-accent-fg"
                >
                  Старт
                </button>
              )}
              <button
                onClick={reset}
                className="min-h-12 rounded-xl border border-border bg-card px-5 py-2.5 font-medium text-muted"
              >
                Сброс
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
