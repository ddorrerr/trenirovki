import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../i18n';

export type MenuAction = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
} & ({ run: () => void; href?: never } | { href: string; run?: never });

/** Native top-layer popover: the same visible entry on touch and desktop. */
export default function ActionMenu({ actions, label }: { actions: MenuAction[]; label?: string }) {
  const { t } = useT();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: Event) => {
      if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) menu.current?.hidePopover();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);
  const toggle = () => {
    const element = menu.current;
    if (!element || !trigger.current) return;
    if (element.matches(':popover-open')) return element.hidePopover();
    const bounds = trigger.current.getBoundingClientRect();
    const height = actions.length * 44 + 16;
    element.style.left = `${Math.max(8, Math.min(bounds.right - 240, window.innerWidth - 248))}px`;
    element.style.top = `${Math.max(8, bounds.bottom + height < window.innerHeight ? bounds.bottom + 4 : bounds.top - height - 4)}px`;
    element.showPopover();
    element.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])')?.focus({ preventScroll: true });
  };
  return (
    <>
      <button ref={trigger} type="button" aria-label={label ?? t.actions.exerciseActions}
        aria-haspopup="menu" aria-controls={id} aria-expanded={open}
        onClick={toggle} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-chip">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label={label ?? t.actions.exerciseActions}
        onToggle={(event) => setOpen(event.newState === 'open')}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])')];
          const index = buttons.indexOf(document.activeElement as HTMLElement);
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }
          if (event.key === 'Escape') trigger.current?.focus({ preventScroll: true });
        }}
        className="fixed bottom-auto right-auto m-0 w-60 rounded-xl border border-border bg-card p-2 text-fg shadow-md">
        {actions.map((action) => {
          const className = 'flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-chip focus-visible:bg-chip disabled:opacity-40 ' + (action.danger ? 'text-danger' : '');
          return action.href !== undefined
            ? <a key={action.label} role="menuitem" href={action.disabled ? undefined : action.href} target="_blank" rel="noopener noreferrer"
                aria-disabled={action.disabled || undefined} tabIndex={action.disabled ? -1 : undefined}
                onClick={() => menu.current?.hidePopover()} className={className}>{action.label}</a>
            : <button key={action.label} type="button" role="menuitem" disabled={action.disabled}
                onClick={() => { menu.current?.hidePopover(); action.run(); }} className={className}>{action.label}</button>;
        })}
      </div>
    </>
  );
}
