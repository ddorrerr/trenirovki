import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExerciseKind, Workout } from '../../types';
import { useApp } from '../../store';
import { tr, useT } from '../../i18n';
import { moveOrderItem } from '../../lib/workout-order';

export default function WorkoutOrderDialog({ workout, selectedId, onSave, onClose }: {
  workout: Workout;
  selectedId?: string;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { exerciseById, itemKind, setDirtyGuard } = useApp();
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const initial = useRef((['warmup', 'main', 'cardio'] as ExerciseKind[])
    .flatMap((kind) => [...workout.items].sort((a, b) => a.order - b.order).filter((item) => itemKind(item) === kind).map((item) => item.id)));
  const [ids, setIds] = useState(initial.current);
  const [drag, setDrag] = useState<{ id: string; y: number; offset: number; left: number; width: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const items = useMemo(() => new Map(workout.items.map((item) => [item.id, item])), [workout.items]);
  const dirty = ids.join('|') !== initial.current.join('|');
  const close = () => {
    if (dirty && !window.confirm(t.editor.discardConfirm)) return;
    setDirtyGuard(null); onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
    if (selectedId) list.current?.querySelector<HTMLElement>(`[data-order-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest' });
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    setDirtyGuard(dirty ? () => window.confirm(tr().editor.unsavedLeave) : null);
    return () => setDirtyGuard(null);
  }, [dirty, setDirtyGuard]);
  const move = (from: string, to: string) => {
    const first = items.get(from), second = items.get(to);
    if (!first || !second || itemKind(first) !== itemKind(second)) return;
    setIds((current) => moveOrderItem(current, from, to));
  };
  const targetAt = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-order-id]');
    if (target?.dataset.orderId && dragRef.current) move(dragRef.current.id, target.dataset.orderId);
  };
  useEffect(() => {
    if (!drag) return;
    let frame: number;
    const scroll = () => {
      const current = dragRef.current, scroller = list.current;
      if (current && scroller) {
        const bounds = scroller.getBoundingClientRect();
        const step = current.y < bounds.top + 50 ? -8 : current.y > bounds.bottom - 50 ? 8 : 0;
        if (step) { scroller.scrollBy(0, step); targetAt(bounds.left + bounds.width / 2, current.y); }
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [!!drag]);
  const name = (id: string) => {
    const item = items.get(id)!;
    return t.catalog.exercise(exerciseById(item.exerciseId)?.name ?? item.nameRaw);
  };
  return (
    <dialog ref={dialog} aria-labelledby="order-title" onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-0 text-fg backdrop:bg-black/40">
      <div className="flex max-h-[85dvh] flex-col">
        <div className="shrink-0 border-b border-border p-4">
          <h2 id="order-title" className="text-lg font-bold">{t.actions.reorder}</h2>
          <p className="mt-1 text-sm text-muted">{t.actions.reorderHint}</p>
        </div>
        <div ref={list} className="min-h-0 space-y-2 overflow-y-auto p-3">
          {ids.map((id, index) => {
            const item = items.get(id)!;
            const kind = itemKind(item);
            const previous = ids[index - 1], next = ids[index + 1];
            const firstInGroup = !previous || itemKind(items.get(previous)!) !== kind;
            const lastInGroup = !next || itemKind(items.get(next)!) !== kind;
            return <div key={id}>
              {firstInGroup && <h3 className="mb-2 px-1 pt-2 text-sm font-semibold text-muted">{kind === 'warmup' ? t.train.warmup : kind === 'cardio' ? t.train.cardio : t.train.exercises}</h3>}
              <div data-order-id={id} className={'flex min-h-14 items-center gap-2 rounded-xl border px-2 py-1 ' +
                (id === selectedId ? 'border-accent bg-accent-soft' : 'border-border bg-bg') + (drag?.id === id ? ' opacity-40' : '')}>
                <button type="button" aria-label={t.actions.dragExercise(name(id))}
                  className="flex h-11 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted active:cursor-grabbing"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
                    setDrag({ id, y: event.clientY, offset: event.clientY - bounds.top, left: bounds.left, width: bounds.width });
                  }}
                  onPointerMove={(event) => {
                    if (!dragRef.current) return;
                    setDrag((current) => current ? { ...current, y: event.clientY } : null);
                    targetAt(event.clientX, event.clientY);
                  }}
                  onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
                  <svg width="16" height="24" viewBox="0 0 16 24" fill="currentColor" aria-hidden="true">
                    {[6, 12, 18].map((y) => <g key={y}><circle cx="5" cy={y} r="1.5" /><circle cx="11" cy={y} r="1.5" /></g>)}
                  </svg>
                </button>
                <span className="min-w-0 flex-1 text-sm font-semibold">{name(id)}</span>
                <button type="button" disabled={firstInGroup} aria-label={t.actions.moveUp(name(id))} onClick={() => move(id, previous)}
                  className="h-11 w-10 shrink-0 rounded-lg text-lg text-accent disabled:opacity-30">↑</button>
                <button type="button" disabled={lastInGroup} aria-label={t.actions.moveDown(name(id))} onClick={() => move(id, next)}
                  className="h-11 w-10 shrink-0 rounded-lg text-lg text-accent disabled:opacity-30">↓</button>
              </div>
            </div>;
          })}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border p-3">
          <button type="button" autoFocus onClick={close} className="min-h-11 rounded-xl border border-border px-4 font-medium">{t.cancel}</button>
          <button type="button" disabled={!dirty} onClick={() => { setDirtyGuard(null); onSave(ids); }}
            className="min-h-11 flex-1 rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-40">{t.save}</button>
        </div>
      </div>
      {drag && <div aria-hidden="true" className="pointer-events-none fixed z-50 rounded-xl border border-accent bg-card px-4 py-4 text-sm font-semibold"
        style={{ left: drag.left, top: drag.y - drag.offset, width: drag.width }}>{name(drag.id)}</div>}
    </dialog>
  );
}
