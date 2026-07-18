// Выбор упражнения с поиском: кнопка + выпадающая панель со списком.
// Опции отсортированы по числу появлений в тренировках (число показано справа).

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';

export interface ExerciseOption {
  id: string;
  name: string;
  /** сколько раз упражнение встречается в тренировках */
  count: number;
  /** строка для поиска: имя + алиасы, в нижнем регистре */
  search: string;
}

interface Props {
  options: ExerciseOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ExercisePicker({ options, selectedId, onSelect }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const selected = options.find((o) => o.id === selectedId) ?? null;
  const q = query.trim().toLowerCase();
  // в en-режиме поиск находит и по английскому названию
  const filtered = q
    ? options.filter(
        (o) => o.search.includes(q) || t.catalog.exercise(o.name).toLowerCase().includes(q),
      )
    : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate font-medium">
          {selected ? t.catalog.exercise(selected.name) : t.combo.pick}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={'shrink-0 text-muted transition-transform ' + (open ? 'rotate-180' : '')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} aria-hidden="true" />
          <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-border bg-card p-2 shadow-lg">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
              }}
              placeholder={t.lib.searchPlaceholder}
              aria-label={t.lib.searchAria}
              className="mb-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
            />
            <ul role="listbox" aria-label={t.prog.pickerListAria} className="max-h-72 overflow-y-auto">
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.id === selectedId}
                    onClick={() => {
                      onSelect(o.id);
                      close();
                    }}
                    className={
                      'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ' +
                      (o.id === selectedId ? 'bg-accent-soft font-medium' : 'hover:bg-accent-soft/50')
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{t.catalog.exercise(o.name)}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{o.count}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">{t.lib.nothingFound}</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
