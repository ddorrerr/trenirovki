import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { XIcon } from './icons';

type Point = { x: number; y: number };
const POSITION_KEY = 'trenirovki:timer-position:v1';
const SIZE = 140;
function bounds(point: Point): Point {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const left = (viewport?.offsetLeft ?? 0) + 12;
  const top = (viewport?.offsetTop ?? 0) + 16;
  const bottomSpace = width < 768 ? 100 : 24;
  return { x: Math.max(left, Math.min(point.x, left + width - SIZE - 24)),
    y: Math.max(top, Math.min(point.y, top + height - SIZE - bottomSpace - 16)) };
}
function initialPosition(): Point {
  try {
    const saved = JSON.parse(sessionStorage.getItem(POSITION_KEY) ?? 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return bounds(saved);
  } catch { /* storage is optional */ }
  return bounds({ x: (window.innerWidth - SIZE) / 2, y: window.innerHeight });
}

/** Long hold moves; a quick horizontal swipe dismisses; a tap opens. */
export default function TimerDock({ children, onOpen, onDismiss }: { children: ReactNode; onOpen: () => void; onDismiss: () => void }) {
  const { t } = useT();
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const hold = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const gesture = useRef<{ id: number; origin: Point; start: Point; at: number; mode: 'hold' | 'drag' | 'swipe' | 'cancel' } | null>(null);
  const clearHold = () => { if (hold.current != null) window.clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => clearHold(), []);
  useLayoutEffect(() => {
    const fit = () => setPosition(point => bounds(point));
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);
  const remember = (point: Point) => { try { sessionStorage.setItem(POSITION_KEY, JSON.stringify(point)); } catch { /* optional */ } };
  const cancel = () => { clearHold(); gesture.current = null; setDragging(false); setSwipe(0); };
  return <div className="timer-dock-position" style={{ left: position.x, top: position.y, transform: `translateX(${swipe}px)`, opacity: 1 - Math.min(Math.abs(swipe) / 180, .55) }}>
    <button type="button" className="timer-dock" data-dragging={dragging || undefined} aria-label={t.timer.openAria} title={t.timer.gestureHint}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return;
        suppressClick.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { id: event.pointerId, origin: position, start: { x: event.clientX, y: event.clientY }, at: Date.now(), mode: 'hold' };
        hold.current = window.setTimeout(() => {
          if (gesture.current?.mode !== 'hold') return;
          gesture.current.mode = 'drag'; suppressClick.current = true; setDragging(true);
          try { navigator.vibrate?.(20); } catch { /* unsupported */ }
        }, 400);
      }}
      onPointerMove={event => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.start.x, dy = event.clientY - g.start.y;
        if (g.mode === 'hold' && Math.hypot(dx, dy) > 10) {
          clearHold(); suppressClick.current = true;
          g.mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'swipe' : 'cancel';
        }
        if (g.mode === 'drag') setPosition(bounds({ x: g.origin.x + dx, y: g.origin.y + dy }));
        if (g.mode === 'swipe') setSwipe(dx);
      }}
      onPointerUp={event => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.start.x, dy = event.clientY - g.start.y;
        if (g.mode === 'drag') remember(bounds({ x: g.origin.x + dx, y: g.origin.y + dy }));
        const dismiss = g.mode === 'swipe' && Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - g.at < 700;
        cancel();
        if (dismiss) onDismiss();
      }}
      onPointerCancel={() => { suppressClick.current = true; cancel(); }}
      onLostPointerCapture={cancel}
      onClick={() => { if (!suppressClick.current) onOpen(); suppressClick.current = false; }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const next = bounds({ x: position.x + (event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0), y: position.y + (event.key === 'ArrowDown' ? 16 : event.key === 'ArrowUp' ? -16 : 0) });
        setPosition(next); remember(next);
      }}>
      {children}
    </button>
    <button type="button" className="timer-dock__close" aria-label={t.timer.closeAria} onClick={onDismiss}><XIcon size={18} /></button>
  </div>;
}
