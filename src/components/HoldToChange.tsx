import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const HOLD_MS = 1200;

/** A deliberate pointer hold; keyboard and assistive activation keep normal button semantics. */
export default function HoldToChange({ children, label, hint, holdingHint, doneHint, onChange }: {
  children: ReactNode;
  label: string;
  hint: string;
  holdingHint: string;
  doneHint: string;
  onChange: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [instant, setInstant] = useState(false);
  const timer = useRef<number | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const action = useRef(onChange);
  action.current = onChange;
  const cancel = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    press.current = null;
    setHolding(false);
    setCompleted(false);
  }, []);
  useEffect(() => {
    const hide = () => { if (document.visibilityState !== 'visible') cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancel]);
  return <button type="button" aria-label={label} title={hint}
    data-holding={holding || undefined} data-instant={instant || undefined}
    className="hold-control rounded-2xl border border-border bg-card p-3.5 text-left"
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0 || press.current) return;
      setInstant(false); setCompleted(false); setHolding(true);
      press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (!press.current || document.visibilityState !== 'visible') return;
        action.current(); setCompleted(true);
      }, HOLD_MS);
    }}
    onPointerMove={event => {
      const current = press.current;
      if (current && current.id === event.pointerId && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10) cancel();
    }}
    onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onContextMenu={event => event.preventDefault()}
    onClick={event => {
      // A pointer click never swaps. Native keyboard/VoiceOver clicks have detail=0.
      if (event.detail === 0) { cancel(); setInstant(true); action.current(); }
    }}>
    <span aria-hidden="true" className="hold-control__fill" />
    <span className="hold-control__content">{children}</span>
    <span aria-live="polite" className="hold-control__hint">{completed ? doneHint : holding ? holdingHint : hint}</span>
  </button>;
}
