// Поисковый выбор упражнения из библиотеки (имя + алиасы, без архива)
// с возможностью тут же создать новое. Панель раскрывается внутри
// карточки — на телефоне это надёжнее плавающего поповера.

import { useMemo, useState } from 'react';
import type { Exercise } from '../../types';
import { useT } from '../../i18n';
import { IconCheck, IconPlus } from './ui';

interface Props {
  exercises: Exercise[];
  /** id выбранного упражнения; '' — ещё не выбрано */
  value: string;
  onSelect: (ex: Exercise) => void;
  /** создать упражнение с таким названием и назначить его */
  onCreate: (name: string) => void;
}

export default function ExerciseCombobox({ exercises, value, onSelect, onCreate }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = exercises.find((e) => e.id === value) ?? null;
  const q = query.trim().toLowerCase();

  const options = useMemo(() => {
    return exercises
      .filter((e) => !e.archived)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          // в en-режиме поиск находит и по английскому названию
          t.catalog.exercise(e.name).toLowerCase().includes(q) ||
          (e.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [exercises, q, t]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-left"
      >
        {current ? (
          <span className="block break-words text-lg font-semibold leading-snug">
            {t.catalog.exercise(current.name)}
          </span>
        ) : (
          <span className="text-muted">{t.combo.pick}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-bg">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.lib.searchPlaceholder}
              aria-label={t.lib.searchAria}
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {options.map((e) => {
              const viaAlias =
                q !== '' &&
                !e.name.toLowerCase().includes(q) &&
                (e.aliases ?? []).find((a) => a.toLowerCase().includes(q));
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(e);
                      close();
                    }}
                    className={
                      'flex w-full items-center gap-2 px-3 py-2.5 text-left ' +
                      (e.id === value ? 'bg-accent-soft' : '')
                    }
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium leading-snug">
                        {t.catalog.exercise(e.name)}
                      </span>
                      {viaAlias && (
                        <span className="block break-words text-sm text-muted">{viaAlias}</span>
                      )}
                    </span>
                    {e.id === value && (
                      <span className="shrink-0 text-accent">
                        <IconCheck size={16} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">{t.lib.nothingFound}</li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              onCreate(query.trim() || t.lib.newExercise);
              close();
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left font-medium text-accent"
          >
            <IconPlus size={16} />
            <span className="min-w-0 break-words">
              {query.trim() ? t.combo.createNamed(query.trim()) : t.combo.createNew}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
