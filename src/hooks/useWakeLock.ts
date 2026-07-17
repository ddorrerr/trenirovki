// Wake Lock: не даём экрану гаснуть, пока открыто приложение.
// Контракт (экспорты) не менять: App.tsx вызывает useWakeLock(settings.keepAwake).

import { useEffect, useRef } from 'react';

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  // Предупреждаем в консоли один раз, чтобы не зациклиться на повторных ошибках.
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!active || !wakeLockSupported()) return;

    let cancelled = false;

    const request = async (): Promise<void> => {
      if (cancelled || document.visibilityState !== 'visible') return;
      // Уже держим активный сентинел — повторный запрос не нужен.
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          // Эффект успел завершиться, пока ждали — сразу отпускаем.
          void sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
      } catch (e) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          console.warn('Wake Lock недоступен:', e);
        }
      }
    };

    // Браузер сам отпускает блокировку при сворачивании вкладки —
    // при возвращении запрашиваем заново.
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}
